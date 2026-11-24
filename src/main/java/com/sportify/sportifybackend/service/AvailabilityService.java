package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.entity.Field;
import com.sportify.sportifybackend.entity.OpeningHour;
import com.sportify.sportifybackend.entity.Reservation;
import com.sportify.sportifybackend.entity.SportComplex;
import com.sportify.sportifybackend.repository.FieldRepository;
import com.sportify.sportifybackend.repository.FieldUnavailabilityRepository;
import com.sportify.sportifybackend.repository.OpeningHourRepository;
import com.sportify.sportifybackend.repository.ReservationRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
public class AvailabilityService {

    private static final ZoneId COMPLEX_ZONE =
            ZoneId.of("Africa/Casablanca");

    private static final Duration SLOT_DURATION =
            Duration.ofHours(1);

    private final FieldRepository fields;
    private final FieldScheduleService schedules;
    private final ReservationRepository reservations;
    private final FieldUnavailabilityRepository unavailabilities;

    public AvailabilityService(
            FieldRepository fields,
            FieldScheduleService schedules,
            ReservationRepository reservations,
            FieldUnavailabilityRepository unavailabilities
    ) {
        this.fields = fields;
        this.schedules = schedules;
        this.reservations = reservations;
        this.unavailabilities = unavailabilities;
    }

    public record SlotResponse(Instant startAt, Instant endAt) {
    }

    @Transactional(readOnly = true)
    public List<SlotResponse> getAvailableSlots(Long fieldId, LocalDate date) {
        // 1. Terrain actif, dans un complexe actif.
        Field field = fields
                .findByIdAndActiveTrueAndComplex_Status(
                        fieldId,
                        SportComplex.Status.ACTIVE
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Terrain introuvable"
                ));

        // 2. Horaire du complexe pour le jour demandé.
        var hours = schedules.effectiveHours(fieldId, field.getComplex().getId())
                .stream()
                .filter(h -> h.day() == date.getDayOfWeek())
                .findFirst()
                .orElse(null);

        if (hours == null) {
            return List.of();
        }

        LocalDateTime opening = date.atTime(hours.opening());
        LocalDateTime closing = date.atTime(hours.closing());

        // Pour cette étape, on accepte les horaires
        // dont l'ouverture et la fermeture sont le même jour.
        if (!closing.isAfter(opening)) {
            return List.of();
        }

        Instant now = Instant.now();
        List<SlotResponse> available = new ArrayList<>();

        // 3. Construire des créneaux d'une heure.
        for (
                LocalDateTime start = opening;
                !start.plusHours(1).isAfter(closing);
                start = start.plusHours(1)
        ) {
            LocalDateTime end = start.plusHours(1);

            // Éviter les heures locales ambiguës ou inexistantes
            // lors d'un changement d'heure.
            if (COMPLEX_ZONE.getRules().getValidOffsets(start).size() != 1
                    || COMPLEX_ZONE.getRules().getValidOffsets(end).size() != 1) {
                continue;
            }

            Instant startAt = start.atZone(COMPLEX_ZONE).toInstant();
            Instant endAt = end.atZone(COMPLEX_ZONE).toInstant();

            if (!Duration.between(startAt, endAt).equals(SLOT_DURATION)) {
                continue;
            }

            // 4. Ne pas proposer un créneau déjà commencé.
            if (!startAt.isAfter(now)) {
                continue;
            }

            // 5. Vérifier réservations et fermetures.
            boolean reserved = reservations.existsOverlap(
                    fieldId,
                    Reservation.Status.CONFIRMED,
                    startAt,
                    endAt
            );

            boolean unavailable = unavailabilities.existsOverlap(
                    fieldId,
                    startAt,
                    endAt
            );

            if (!reserved && !unavailable) {
                available.add(new SlotResponse(startAt, endAt));
            }
        }

        return available;
    }
}
