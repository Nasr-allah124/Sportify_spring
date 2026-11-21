package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.OwnerApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OwnerApplicationRepository extends JpaRepository<OwnerApplication, Long> {

    Optional<OwnerApplication> findFirstByApplicant_IdOrderByIdDesc(Long applicantId);
}