package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.Field;
import com.sportify.sportifybackend.entity.SportComplex;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface FieldRepository extends JpaRepository<Field, Long> {

    @Query("""
            select f from Field f
            join fetch f.complex c
            where f.active = true and c.status = :status
              and (:city = '' or lower(c.city) = lower(:city))
              and f.sportType in :sports
            order by f.id
            """)
    List<Field> findVisibleFields(
            @Param("status") SportComplex.Status status,
            @Param("city") String city,
            @Param("sports") Set<Field.SportType> sports
    );

    @EntityGraph(attributePaths = "complex")
    Optional<Field> findByIdAndActiveTrueAndComplex_Status(
            Long id, SportComplex.Status status
    );
}