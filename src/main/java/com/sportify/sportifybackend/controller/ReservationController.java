package com.sportify.sportifybackend.controller;

import com.sportify.sportifybackend.service.ReservationService;
import com.sportify.sportifybackend.service.ReservationService.ReservationResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import com.sportify.sportifybackend.service.ReservationService.MyReservationResponse;
import org.springframework.web.bind.annotation.GetMapping;
import java.util.List;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
@RestController
@RequestMapping("/api/v1/reservations")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    public record CreateReservationRequest(
            @NotNull @Positive Long fieldId,
            @NotNull Instant startAt
    ) {
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateReservationRequest request
    ) {
        Long userId = Long.valueOf(jwt.getSubject());

        return reservationService.createReservation(
                userId,
                request.fieldId(),
                request.startAt()
        );
    }
    @GetMapping("/me")
public List<MyReservationResponse> myReservations(
        @AuthenticationPrincipal Jwt jwt
) {
    Long userId = Long.valueOf(jwt.getSubject());

    return reservationService.getMyReservations(userId);
}
@PatchMapping("/{reservationId}/cancel")
public MyReservationResponse cancel(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable("reservationId") Long reservationId
) {
    Long userId = Long.valueOf(jwt.getSubject());

    return reservationService.cancelReservation(
            userId,
            reservationId
    );
}
}