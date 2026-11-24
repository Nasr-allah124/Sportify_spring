package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.entity.Field.SportType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import com.sportify.sportifybackend.service.FieldScheduleService.Hours;
import com.sportify.sportifybackend.service.FieldScheduleService;

@RestController
@RequestMapping("/api/v1")
public class OwnerFieldController {

    private final JdbcTemplate db;
    private final FieldScheduleService schedules;

    public OwnerFieldController(JdbcTemplate db, FieldScheduleService schedules) {
        this.db = db;
        this.schedules = schedules;
    }

    public record Hour(
            @NotNull DayOfWeek day,
            @NotNull LocalTime opening,
            @NotNull LocalTime closing
    ) {}

    public record NewField(
            @NotBlank @Size(max = 150) String name,
            @NotNull SportType sport,
            @NotNull @Positive @Digits(integer = 8, fraction = 2) BigDecimal price,
            @Positive Integer capacity,
            @Size(max = 2000) String description,
            @NotNull @Size(max = 7) List<@NotNull @Valid Hour> hours
    ) {}

    public record Complex(long id, String name, boolean hasHours) {}

    public record Created(long id) {}

    @GetMapping("/owner/fields")
    @Transactional(readOnly = true)
    public Complex mine(@AuthenticationPrincipal Jwt jwt) {
        return findComplex(jwt, false);
    }

    @PostMapping(
            value = "/owner/fields",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional(rollbackFor = IOException.class)
    public Created create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestPart("field") NewField field,
            @RequestPart(value = "photos", required = false) List<MultipartFile> photos
    ) throws IOException {
        Complex complex = findComplex(jwt, true);

        // Relire après acquisition du verrou si deux terrains sont ajoutés simultanément.
        boolean hasHours = Boolean.TRUE.equals(db.queryForObject("""
                select exists (
                    select 1 from opening_hours where complex_id = ?
                )
                """, Boolean.class, complex.id()));

        if (!hasHours && field.hours().isEmpty()) {
            throw invalid("Indiquez les horaires du complexe");
        }

        if (hasHours && !field.hours().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Les horaires ont déjà été définis. Rechargez le formulaire."
            );
        }

        saveHours(complex.id(), field.hours());

        Long fieldId = db.queryForObject("""
                insert into fields (
                    complex_id, name, sport_type, hourly_price,
                    capacity, description, active
                )
                values (?, ?, ?, ?, ?, ?, true)
                returning id
                """,
                Long.class,
                complex.id(),
                field.name().strip(),
                field.sport().name(),
                field.price(),
                field.capacity(),
                field.description()
        );

        if (photos != null) {
            savePhotos(fieldId, photos);
        }

        return new Created(fieldId);
    }

    private Complex findComplex(Jwt jwt, boolean lock) {
        String sql = """
                select c.id, c.name,
                       exists (
                           select 1 from opening_hours h where h.complex_id = c.id
                       ) as has_hours
                from sport_complexes c
                join users u on u.id = c.owner_id
                where u.id = ?
                  and u.enabled
                  and u.email_verified
                  and u.role = 'OWNER'
                """;

        if (lock) {
            sql += " for update of c";
        }

        return db.query(
                        sql,
                        (row, index) -> new Complex(
                                row.getLong("id"),
                                row.getString("name"),
                                row.getBoolean("has_hours")
                        ),
                        Long.valueOf(jwt.getSubject())
                )
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Aucun complexe rattaché à ce compte propriétaire"
                ));
    }

    private void saveHours(long complexId, List<Hour> hours) {
        var days = EnumSet.noneOf(DayOfWeek.class);

        for (Hour hour : hours) {
            if (!days.add(hour.day())) {
                throw invalid("Un jour apparaît deux fois dans les horaires");
            }

            if (Duration.between(hour.opening(), hour.closing()).toMinutes() < 60) {
                throw invalid("Prévoyez au moins une heure d’ouverture le même jour");
            }

            db.update("""
                    insert into opening_hours (
                        complex_id, day_of_week, opening_time, closing_time
                    )
                    values (?, ?, ?, ?)
                    """,
                    complexId, hour.day().name(), hour.opening(), hour.closing()
            );
        }
    }

    private void savePhotos(long fieldId, List<MultipartFile> photos) throws IOException {
        if (photos.size() > 6) {
            throw invalid("Six photos maximum");
        }

        for (int position = 0; position < photos.size(); position++) {
            MultipartFile photo = photos.get(position);

            if (photo.isEmpty() || photo.getSize() > 1024 * 1024) {
                throw invalid("Chaque photo doit faire entre 1 octet et 1 Mo");
            }

            byte[] bytes = photo.getBytes();
            String mime = imageType(bytes);

            db.update("""
                    insert into field_images (
                        field_id, storage_key, position, photo_mime, photo_bytes
                    )
                    values (?, ?, ?, ?, ?)
                    """,
                    fieldId,
                    "fields/" + fieldId + "/" + position,
                    position,
                    mime,
                    bytes
            );
        }
    }

    private static String imageType(byte[] bytes) {
        byte[] png = {(byte) 137, 80, 78, 71, 13, 10, 26, 10};

        if (bytes.length >= png.length
                && Arrays.equals(bytes, 0, png.length, png, 0, png.length)) {
            return "image/png";
        }

        if (bytes.length > 3
                && bytes[0] == (byte) 255
                && bytes[1] == (byte) 216
                && bytes[2] == (byte) 255) {
            return "image/jpeg";
        }

        throw invalid("Utilisez une photo JPEG ou PNG");
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static final String VISIBLE_PHOTOS = """
            from field_images i
            join fields f on f.id = i.field_id
            join sport_complexes c on c.id = f.complex_id
            where f.active and c.status = 'ACTIVE'
              and f.id = ? and i.photo_bytes is not null
            """;

    @GetMapping("/field-photos/{id}")
    public List<Integer> positions(@PathVariable long id) {
        return db.queryForList(
                "select i.position " + VISIBLE_PHOTOS + " order by i.position",
                Integer.class,
                id
        );
    }

    @GetMapping("/field-photos/{id}/{position}")
    public ResponseEntity<byte[]> photo(
            @PathVariable long id,
            @PathVariable int position
    ) {
        return db.query(
                        "select i.photo_mime, i.photo_bytes "
                                + VISIBLE_PHOTOS + " and i.position = ?",
                        (row, index) -> ResponseEntity.ok()
                                .contentType(MediaType.parseMediaType(row.getString(1)))
                                .body(row.getBytes(2)),
                        id, position
                )
                .stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    public record ManagedField(
            long id,
            String name,
            String sport,
            BigDecimal hourlyPrice,
            boolean active,
            long confirmedBookings
    ) {}

    public record FieldState(@NotNull Boolean active) {}

    @GetMapping("/owner/fields/management")
    @Transactional(readOnly = true)
    public List<ManagedField> managedFields(@AuthenticationPrincipal Jwt jwt) {
        Complex complex = findComplex(jwt, false);

        return db.query("""
            select f.id, f.name, f.sport_type, f.hourly_price, f.active,
                   (
                       select count(*)
                       from reservations r
                       where r.field_id = f.id
                         and r.status = 'CONFIRMED'
                         and r.end_at > current_timestamp
                   ) as confirmed_bookings
            from fields f
            where f.complex_id = ?
            order by f.active desc, f.name, f.id
            """,
                (row, index) -> new ManagedField(
                        row.getLong("id"),
                        row.getString("name"),
                        row.getString("sport_type"),
                        row.getBigDecimal("hourly_price"),
                        row.getBoolean("active"),
                        row.getLong("confirmed_bookings")
                ),
                complex.id()
        );
    }

    @PutMapping("/owner/fields/{id}/state")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void updateFieldState(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long id,
            @Valid @RequestBody FieldState request
    ) {
        Complex complex = findComplex(jwt, false);

        int updated = db.update("""
            update fields
            set active = ?
            where id = ? and complex_id = ?
            """,
                request.active(),
                id,
                complex.id()
        );

        if (updated == 0) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Terrain introuvable dans votre complexe"
            );
        }
    }
    public record FieldEdit(
            @NotBlank @Size(max = 150) String name,
            @NotNull SportType sport,
            @NotNull @Positive @Digits(integer = 8, fraction = 2) BigDecimal price,
            @Positive Integer capacity,
            @Size(max = 2000) String description,
            @NotNull @Size(max = 7)
            List<@NotNull @Valid Hours> hours
    ) {}

    @GetMapping("/owner/fields/{id}/details")
    @Transactional(readOnly = true)
    public FieldEdit getFieldToEdit(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long id
    ) {
        Complex complex = findComplex(jwt, false);

        var rows = db.query("""
            select name, sport_type, hourly_price, capacity, description
            from fields
            where id = ? and complex_id = ?
            """,
                (row, index) -> new FieldEdit(
                        row.getString("name"),
                        SportType.valueOf(row.getString("sport_type")),
                        row.getBigDecimal("hourly_price"),
                        row.getObject("capacity", Integer.class),
                        row.getString("description"),
                        List.of()
                ),
                id, complex.id()
        );

        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Terrain introuvable");
        }

        FieldEdit f = rows.getFirst();

        return new FieldEdit(
                f.name(), f.sport(), f.price(), f.capacity(), f.description(),
                schedules.effectiveHours(id, complex.id())
        );
    }

    @PutMapping("/owner/fields/{id}/details")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void updateField(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long id,
            @Valid @RequestBody FieldEdit request
    ) {
        Complex complex = findComplex(jwt, false);

        // Même ligne verrouillée que lors de la création d’une réservation.
        var owned = db.queryForList("""
            select id from fields
            where id = ? and complex_id = ?
            for update
            """, Long.class, id, complex.id());

        if (owned.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Terrain introuvable");
        }

        schedules.updateHours(id, complex.id(), request.hours());

        db.update("""
            update fields
            set name = ?, sport_type = ?, hourly_price = ?,
                capacity = ?, description = ?
            where id = ? and complex_id = ?
            """,
                request.name().strip(),
                request.sport().name(),
                request.price(),
                request.capacity(),
                request.description() == null ? null : request.description().strip(),
                id,
                complex.id()
        );
    }



}
