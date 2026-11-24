package com.sportify.sportifybackend.service;

import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;

@Service
public class FieldScheduleService {

    private final JdbcTemplate db;

    public FieldScheduleService(JdbcTemplate db) {
        this.db = db;
    }

    public record Hours(
            @NotNull DayOfWeek day,
            @NotNull LocalTime opening,
            @NotNull LocalTime closing
    ) {}

    public List<Hours> effectiveHours(long fieldId, long complexId) {
        List<Hours> result = db.query("""
                select day_of_week, opening_time, closing_time
                from field_opening_hours
                where field_id = ?

                union all

                select day_of_week, opening_time, closing_time
                from opening_hours
                where complex_id = ?
                  and not exists (
                      select 1 from field_opening_hours where field_id = ?
                  )
                """,
                (row, index) -> new Hours(
                        DayOfWeek.valueOf(row.getString("day_of_week")),
                        row.getObject("opening_time", LocalTime.class),
                        row.getObject("closing_time", LocalTime.class)
                ),
                fieldId, complexId, fieldId
        );

        return result.stream()
                .sorted(Comparator.comparing(Hours::day))
                .toList();
    }

    // Appelé dans la transaction de modification, après verrouillage du terrain.
    public void updateHours(long fieldId, long complexId, List<Hours> requested) {
        var byDay = new EnumMap<DayOfWeek, Hours>(DayOfWeek.class);

        for (Hours h : requested) {
            if (byDay.put(h.day(), h) != null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Un jour apparaît deux fois."
                );
            }

            if (Duration.between(h.opening(), h.closing()).toMinutes() < 60) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Prévoyez au moins une heure d’ouverture le même jour."
                );
            }
        }

        List<Hours> newHours = List.copyOf(byDay.values());

        // Une simple modification du tarif conserve l’héritage des horaires.
        if (newHours.equals(effectiveHours(fieldId, complexId))) {
            return;
        }

        if (newHours.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Choisissez un jour ouvert ou utilisez « Mettre hors service »."
            );
        }

        // Une réservation déjà confirmée doit rester dans une plage ouverte.
        var bookings = db.query("""
                select start_at at time zone 'Africa/Casablanca' as local_start,
                       end_at at time zone 'Africa/Casablanca' as local_end
                from reservations
                where field_id = ?
                  and status = 'CONFIRMED'
                  and end_at > current_timestamp
                order by start_at
                """,
                (row, index) -> new Booking(
                        row.getObject("local_start", java.time.LocalDateTime.class),
                        row.getObject("local_end", java.time.LocalDateTime.class)
                ),
                fieldId
        );

        for (Booking booking : bookings) {
            Hours h = byDay.get(booking.start().getDayOfWeek());

            if (h == null
                    || !booking.start().toLocalDate().equals(booking.end().toLocalDate())
                    || booking.start().toLocalTime().isBefore(h.opening())
                    || booking.end().toLocalTime().isAfter(h.closing())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Une réservation confirmée se trouve hors des nouveaux horaires."
                );
            }
        }

        db.update("delete from field_opening_hours where field_id = ?", fieldId);

        for (Hours h : newHours) {
            db.update("""
                    insert into field_opening_hours
                        (field_id, day_of_week, opening_time, closing_time)
                    values (?, ?, ?, ?)
                    """, fieldId, h.day().name(), h.opening(), h.closing());
        }
    }

    private record Booking(
            java.time.LocalDateTime start,
            java.time.LocalDateTime end
    ) {}
}