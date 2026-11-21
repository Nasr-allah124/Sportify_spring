package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.OpeningHour;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.DayOfWeek;
import java.util.Optional;

public interface OpeningHourRepository extends JpaRepository<OpeningHour, Long> {

    Optional<OpeningHour> findByComplex_IdAndDayOfWeek(
            Long complexId,
            DayOfWeek dayOfWeek
    );
}
