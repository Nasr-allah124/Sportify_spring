package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import java.util.Optional;
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    @Query("""
            select count(r) > 0
            from Reservation r
            where r.field.id = :fieldId
              and r.status = :status
              and r.startAt < :end
              and r.endAt > :start
            """)
    boolean existsOverlap(
            @Param("fieldId") Long fieldId,
            @Param("status") Reservation.Status status,
            @Param("start") Instant start,
            @Param("end") Instant end
    );
    @EntityGraph(attributePaths = {"field", "field.complex"})
List<Reservation> findByClient_IdOrderByStartAtDesc(Long clientId);
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("""
        select r from Reservation r
        where r.id = :reservationId
          and r.client.id = :clientId
        """)
Optional<Reservation> findMineForCancellation(
        @Param("reservationId") Long reservationId,
        @Param("clientId") Long clientId
);
}