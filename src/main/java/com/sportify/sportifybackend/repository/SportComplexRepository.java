package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.SportComplex;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SportComplexRepository extends JpaRepository<SportComplex, Long> {

    List<SportComplex> findByStatusOrderByIdAsc(SportComplex.Status status);
}