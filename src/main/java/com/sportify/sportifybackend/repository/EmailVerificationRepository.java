package com.sportify.sportifybackend.repository;

import com.sportify.sportifybackend.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmailVerificationRepository
        extends JpaRepository<EmailVerification, Long> {

    Optional<EmailVerification> findByUser_Id(Long userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from EmailVerification v where v.user.id = :userId")
    Optional<EmailVerification> findForVerification(@Param("userId") Long userId);
}