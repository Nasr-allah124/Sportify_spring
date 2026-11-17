package com.sportify.sportifybackend.entity;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.Instant;

@Entity
@Table(name = "email_verifications")
@Getter
public class EmailVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "code_digest", nullable = false, length = 64)
    private String codeDigest;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    protected EmailVerification() {
    }

    public EmailVerification(
            User user, String codeDigest, Instant issuedAt, Instant expiresAt
    ) {
        this.user = user;
        replaceCode(codeDigest, issuedAt, expiresAt);
    }

    public void replaceCode(
            String codeDigest, Instant issuedAt, Instant expiresAt
    ) {
        this.codeDigest = codeDigest;
        this.sentAt = issuedAt;
        this.expiresAt = expiresAt;
        this.failedAttempts = 0;
    }

    public void recordFailedAttempt() {
        this.failedAttempts++;
    }
}