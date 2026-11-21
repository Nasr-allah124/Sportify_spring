package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.entity.Field;
import com.sportify.sportifybackend.entity.Reservation;
import com.sportify.sportifybackend.entity.SportComplex;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.FieldRepository;
import com.sportify.sportifybackend.repository.ReservationRepository;
import com.sportify.sportifybackend.repository.UserRepository;
import com.sportify.sportifybackend.service.AvailabilityService.SlotResponse;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.time.Duration;
@Service
public class ReservationService {

    private static final ZoneId COMPLEX_ZONE =
            ZoneId.of("Africa/Casablanca");

    private final FieldRepository fields;
    private final UserRepository users;
    private final ReservationRepository reservations;
    private final AvailabilityService availabilityService;

    public ReservationService(
            FieldRepository fields,
            UserRepository users,
            ReservationRepository reservations,
            AvailabilityService availabilityService
    ) {
        this.fields = fields;
        this.users = users;
        this.reservations = reservations;
        this.availabilityService = availabilityService;
    }

    public record ReservationResponse(
            Long id,
            Long fieldId,
            Instant startAt,
            Instant endAt,
            BigDecimal totalPrice,
            Reservation.Status status
    ) {
        public static ReservationResponse from(Reservation reservation) {
            return new ReservationResponse(
                    reservation.getId(),
                    reservation.getField().getId(),
                    reservation.getStartAt(),
                    reservation.getEndAt(),
                    reservation.getTotalPrice(),
                    reservation.getStatus()
            );
        }
    }

    @Transactional
    public ReservationResponse createReservation(
            Long userId,
            Long fieldId,
            Instant requestedStart
    ) {
        // 1. Vérifier le compte.
        User user = users.findById(userId)
                .filter(User::isEnabled)
                .filter(User::isEmailVerified)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Compte invalide ou non vérifié"
                ));

        // 2. Verrouiller le terrain avant de vérifier le créneau.
        Field field = fields.findByIdForReservation(fieldId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Terrain introuvable"
                ));

        if (!field.isActive()
                || field.getComplex().getStatus() != SportComplex.Status.ACTIVE) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Terrain indisponible"
            );
        }

        // 3. Déduire la date locale du créneau demandé.
        LocalDate date = requestedStart
                .atZone(COMPLEX_ZONE)
                .toLocalDate();

        // 4. Recalculer les disponibilités après le verrouillage.
        SlotResponse selectedSlot = availabilityService
                .getAvailableSlots(fieldId, date)
                .stream()
                .filter(slot -> slot.startAt().equals(requestedStart))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Ce créneau n'est plus disponible"
                ));

        // 5. Le prix vient du serveur, pas du navigateur.
        BigDecimal price = field.getHourlyPrice();

        if (price == null || price.signum() < 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Tarif du terrain invalide"
            );
        }

        // 6. Enregistrer la réservation confirmée.
        Reservation reservation = new Reservation(
                user,
                field,
                selectedSlot.startAt(),
                selectedSlot.endAt(),
                price
        );

        Reservation saved = reservations.save(reservation);

        return ReservationResponse.from(saved);
    }
    public record MyReservationResponse(
        Long id,
        Long fieldId,
        String fieldName,
        String complexName,
        String city,
        Instant startAt,
        Instant endAt,
        BigDecimal totalPrice,
        Reservation.Status status
) {
    public static MyReservationResponse from(Reservation reservation) {
        Field field = reservation.getField();

        return new MyReservationResponse(
                reservation.getId(),
                field.getId(),
                field.getName(),
                field.getComplex().getName(),
                field.getComplex().getCity(),
                reservation.getStartAt(),
                reservation.getEndAt(),
                reservation.getTotalPrice(),
                reservation.getStatus()
        );
    }
}

@Transactional(readOnly = true)
public List<MyReservationResponse> getMyReservations(Long userId) {
    users.findById(userId)
            .filter(User::isEnabled)
            .filter(User::isEmailVerified)
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Compte invalide ou non vérifié"
            ));

    return reservations.findByClient_IdOrderByStartAtDesc(userId)
            .stream()
            .map(MyReservationResponse::from)
            .toList();
}
@Transactional
public MyReservationResponse cancelReservation(
        Long userId,
        Long reservationId
) {
    // 1. Vérifier le compte connecté.
    users.findById(userId)
            .filter(User::isEnabled)
            .filter(User::isEmailVerified)
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Compte invalide ou non vérifié"
            ));

    // 2. Trouver uniquement une réservation du client connecté.
    Reservation reservation = reservations
            .findMineForCancellation(reservationId, userId)
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Réservation introuvable"
            ));

    // Si elle est déjà annulée, retourner son état actuel.
    // Cela permet de répéter une demande sans changer le résultat.
    if (reservation.getStatus() == Reservation.Status.CANCELLED) {
        return MyReservationResponse.from(reservation);
    }

    // 3. Hypothèse : annulation plus de 2 h avant le début.
    Instant cancellationDeadline = Instant.now()
            .plus(Duration.ofHours(2));

    if (!reservation.getStartAt().isAfter(cancellationDeadline)) {
        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Le délai d'annulation est dépassé"
        );
    }

    // 4. Modifier le statut dans la transaction.
    reservation.cancel();

    return MyReservationResponse.from(reservation);
}
}
