package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.entity.Field;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1")
public class OwnerComplexController {

    private final JdbcTemplate jdbc;
    private final UserRepository users;

    public OwnerComplexController(JdbcTemplate jdbc, UserRepository users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    public record ApprovedSite(
            long id,
            String name,
            String city,
            String address
    ) {}

    public record NewSite(
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Size(max = 100) String city,
            @NotBlank @Size(max = 255) String address,
            @NotBlank @Size(max = 30) String phone,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude
    ) {}

    public record CreateComplex(
            @Positive Long applicationId,
            @Valid NewSite newSite,
            @NotBlank @Size(max = 2000) String description,
            @NotBlank @Size(max = 150) String fieldName,
            @NotNull Field.SportType sport,
            @NotNull @DecimalMin("0.01")
            @Digits(integer = 8, fraction = 2) BigDecimal hourlyPrice,
            @NotEmpty Set<@NotNull DayOfWeek> openDays,
            @NotNull LocalTime opens,
            @NotNull LocalTime closes
    ) {}

    public record Created(long complexId, long fieldId) {}

    private record Photo(String type, byte[] bytes) {}

    private long ownerId(Jwt jwt) {
        if (jwt == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        return users.findById(Long.valueOf(jwt.getSubject()))
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .filter(user -> "OWNER".equals(user.getRole().name()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Un compte propriétaire actif est nécessaire."
                ))
                .getId();
    }

    @GetMapping("/owner/complexes/approved-sites")
    public List<ApprovedSite> approvedSites(@AuthenticationPrincipal Jwt jwt) {
        return jdbc.query("""
                SELECT id, complex_name, city, address
                FROM owner_applications
                WHERE applicant_id = ?
                  AND status = 'APPROVED'
                  AND created_complex_id IS NULL
                ORDER BY submitted_at DESC, id DESC
                """,
                (rs, row) -> new ApprovedSite(
                        rs.getLong("id"),
                        rs.getString("complex_name"),
                        rs.getString("city"),
                        rs.getString("address")
                ),
                ownerId(jwt)
        );
    }

    @PostMapping(
            value = "/owner/complexes",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Created create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestPart("data") CreateComplex data,
            @RequestPart(value = "photos", required = false) List<MultipartFile> files
    ) {
        long owner = ownerId(jwt);

        boolean hasApplication = data.applicationId() != null;
        boolean hasNewSite = data.newSite() != null;

        if (hasApplication == hasNewSite) {
            throw badRequest("Choisissez un dossier approuvé ou un nouvel emplacement.");
        }

        long minutes = Duration.between(data.opens(), data.closes()).toMinutes();
        if (minutes < 60) {
            throw badRequest(
                    "La fermeture doit être au moins une heure après l’ouverture, le même jour."
            );
        }

        if (files == null || files.isEmpty() || files.size() > 4) {
            throw badRequest("Choisissez entre une et quatre photos.");
        }

        List<Photo> photos = new ArrayList<>();
        for (MultipartFile file : files) {
            photos.add(readPhoto(file));
        }

        long complexId = hasApplication
                ? createFromApplication(owner, data.applicationId(), data.description())
                : createFromNewSite(owner, data.newSite(), data.description());

        Long fieldId = jdbc.queryForObject("""
                INSERT INTO fields
                    (complex_id, name, sport_type, hourly_price, active)
                VALUES (?, ?, ?, ?, true)
                RETURNING id
                """,
                Long.class,
                complexId,
                data.fieldName().strip(),
                data.sport().name(),
                data.hourlyPrice()
        );

        for (DayOfWeek day : data.openDays()) {
            jdbc.update("""
                    INSERT INTO opening_hours
                        (complex_id, day_of_week, opening_time, closing_time)
                    VALUES (?, ?, ?, ?)
                    """,
                    complexId, day.name(), data.opens(), data.closes()
            );
        }

        for (int index = 0; index < photos.size(); index++) {
            Photo photo = photos.get(index);

            jdbc.update("""
                    INSERT INTO complex_photos
                        (complex_id, position, content_type, content)
                    VALUES (?, ?, ?, ?)
                    """,
                    complexId, index, photo.type(), photo.bytes()
            );
        }

        return new Created(complexId, fieldId);
    }

    private long createFromApplication(
            long owner, long applicationId, String description
    ) {
        List<Long> available = jdbc.queryForList("""
                SELECT id
                FROM owner_applications
                WHERE id = ?
                  AND applicant_id = ?
                  AND status = 'APPROVED'
                  AND created_complex_id IS NULL
                FOR UPDATE
                """, Long.class, applicationId, owner);

        if (available.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ce dossier a déjà été utilisé ou n’est plus disponible."
            );
        }

        Long complexId = jdbc.queryForObject("""
                INSERT INTO sport_complexes
                    (owner_id, name, city, address, phone, description,
                     latitude, longitude, status, created_at)
                SELECT applicant_id, complex_name, city, address, phone, ?,
                       latitude, longitude, 'ACTIVE', CURRENT_TIMESTAMP
                FROM owner_applications
                WHERE id = ?
                RETURNING id
                """, Long.class, description.strip(), applicationId);

        jdbc.update("""
                UPDATE owner_applications
                SET created_complex_id = ?
                WHERE id = ?
                """, complexId, applicationId);

        return complexId;
    }

    private long createFromNewSite(long owner, NewSite site, String description) {
        return jdbc.queryForObject("""
                INSERT INTO sport_complexes
                    (owner_id, name, city, address, phone, description,
                     latitude, longitude, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
                RETURNING id
                """,
                Long.class,
                owner,
                site.name().strip(),
                site.city().strip(),
                site.address().strip(),
                site.phone().strip(),
                description.strip(),
                site.latitude(),
                site.longitude()
        );
    }

    @GetMapping("/complexes/{id}/photos/{position}")
    public ResponseEntity<byte[]> photo(
            @PathVariable("id") long id,
            @PathVariable("position") int position
    ) {
        List<Photo> photos = jdbc.query("""
                SELECT p.content_type, p.content
                FROM complex_photos p
                JOIN sport_complexes c ON c.id = p.complex_id
                WHERE c.id = ?
                  AND c.status = 'ACTIVE'
                  AND p.position = ?
                """,
                (rs, row) -> new Photo(
                        rs.getString("content_type"),
                        rs.getBytes("content")
                ),
                id, position
        );

        if (photos.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Photo photo = photos.get(0);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.type()))
                .header("X-Content-Type-Options", "nosniff")
                .body(photo.bytes());
    }

    private Photo readPhoto(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > 2L * 1024 * 1024) {
            throw badRequest("Chaque photo doit peser entre 1 octet et 2 Mo.");
        }

        try {
            byte[] bytes = file.getBytes();

            try (ImageInputStream stream = ImageIO.createImageInputStream(
                    new ByteArrayInputStream(bytes))) {

                if (stream == null) {
                    throw badRequest("Impossible de lire cette photo.");
                }

                var readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) {
                    throw badRequest("Choisissez une photo JPEG ou PNG.");
                }

                var reader = readers.next();
                try {
                    reader.setInput(stream);
                    String format = reader.getFormatName();

                    String contentType;
                    if ("JPEG".equalsIgnoreCase(format)) {
                        contentType = "image/jpeg";
                    } else if ("PNG".equalsIgnoreCase(format)) {
                        contentType = "image/png";
                    } else {
                        throw badRequest("Choisissez une photo JPEG ou PNG.");
                    }

                    long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                    if (pixels > 12_000_000) {
                        throw badRequest("Une photo dépasse 12 mégapixels.");
                    }

                    reader.read(0);
                    return new Photo(contentType, bytes);
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException ex) {
            throw badRequest("Une des photos est illisible ou endommagée.");
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleRequestError(
            ResponseStatusException ex
    ) {
        String message = ex.getReason() == null
                ? "Cette opération a été refusée."
                : ex.getReason();

        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("message", message));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleInvalidForm(MethodArgumentNotValidException ex) {
        var field = ex.getBindingResult().getFieldError();

        String message = field == null
                ? "Vérifiez les informations du formulaire."
                : switch (field.getField()) {
            case "applicationId" -> "Choisissez un dossier valide.";
            case "newSite.name" -> "Saisissez un nom de complexe de 1 à 150 caractères.";
            case "newSite.city" -> "Choisissez une ville.";
            case "newSite.address" -> "Saisissez une adresse de 1 à 255 caractères.";
            case "newSite.phone" -> "Saisissez un téléphone de 1 à 30 caractères.";
            case "newSite.latitude", "newSite.longitude" ->
                    "Sélectionnez un point valide sur la carte.";
            case "description" -> "Saisissez une description de 1 à 2 000 caractères.";
            case "fieldName" -> "Saisissez un nom de terrain de 1 à 150 caractères.";
            case "sport" -> "Choisissez le sport du terrain.";
            case "hourlyPrice" -> "Saisissez un tarif positif avec au maximum deux décimales.";
            case "openDays" -> "Choisissez au moins un jour d’ouverture.";
            case "opens", "closes" -> "Renseignez l’ouverture et la fermeture.";
            default -> "Vérifiez le champ " + field.getField() + ".";
        };

        return Map.of("message", message);
    }
    public record MyComplex(long id, String name, boolean hasHours) {}

    @GetMapping("/owner/complex")
    public MyComplex myComplex(@AuthenticationPrincipal Jwt jwt) {
        long owner = ownerId(jwt);

        return jdbc.query("""
            SELECT c.id, c.name,
                   EXISTS (
                       SELECT 1
                       FROM opening_hours h
                       WHERE h.complex_id = c.id
                   ) AS has_hours
            FROM sport_complexes c
            WHERE c.owner_id = ?
            """,
                (rs, row) -> new MyComplex(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getBoolean("has_hours")
                ),
                owner
        ).stream().findFirst().orElseThrow(() ->
                new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Aucun complexe n’est encore rattaché à votre compte."
                )
        );
    }
}