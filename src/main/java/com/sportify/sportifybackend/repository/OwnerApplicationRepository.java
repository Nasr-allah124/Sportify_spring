package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.OwnerApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;

public interface OwnerApplicationRepository extends JpaRepository<OwnerApplication, Long> {

    Optional<OwnerApplication> findFirstByApplicant_IdOrderByIdDesc(Long applicantId);
    @EntityGraph(attributePaths = "applicant")
List<OwnerApplication> findByStatusOrderBySubmittedAtAsc(
        OwnerApplication.Status status
);
}