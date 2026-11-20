package com.sportify.sportifybackend.entity;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.Instant;
import java.time.Duration;

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
    private static final Duration RESEND_INTERVAL = Duration.ofSeconds(60);
    private static final Duration RESEND_WINDOW = Duration.ofHours(1);
    private static final int MAX_RESENDS_PER_WINDOW = 3;

    @Column(name = "resend_window_start")
    private Instant resendWindowStart;

    @Column(name = "resend_count", nullable = false, columnDefinition = "integer default 0")
    private int resendCount;

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
    public Duration delayBeforeResend(Instant now) {
        Instant nextAllowedAt = sentAt.plus(RESEND_INTERVAL);

        if (resendWindowStart != null && resendCount >= MAX_RESENDS_PER_WINDOW) {
            Instant windowEnd = resendWindowStart.plus(RESEND_WINDOW);

            if (windowEnd.isAfter(nextAllowedAt)) {
                nextAllowedAt = windowEnd;
            }
        }

        if (now.isBefore(nextAllowedAt)) {
            return Duration.between(now, nextAllowedAt);
        }

        return Duration.ZERO;
    }

    public void recordResend(String newDigest, Instant now) {
        if (resendWindowStart == null
                || !now.isBefore(resendWindowStart.plus(RESEND_WINDOW))) {
            resendWindowStart = now;
            resendCount = 0;
        }

        resendCount++;
        replaceCode(newDigest, now, now.plus(Duration.ofMinutes(10)));
    }
}