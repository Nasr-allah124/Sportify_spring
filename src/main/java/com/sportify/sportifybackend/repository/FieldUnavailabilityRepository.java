package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.FieldUnavailability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface FieldUnavailabilityRepository
        extends JpaRepository<FieldUnavailability, Long> {

    @Query("""
            select count(u) > 0
            from FieldUnavailability u
            where u.field.id = :fieldId
              and u.startAt < :end
              and u.endAt > :start
            """)
    boolean existsOverlap(
            @Param("fieldId") Long fieldId,
            @Param("start") Instant start,
            @Param("end") Instant end
    );
}
