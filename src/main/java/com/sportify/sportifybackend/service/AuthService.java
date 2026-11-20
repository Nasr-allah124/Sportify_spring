package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.dto.request.RegisterRequest;
import com.sportify.sportifybackend.dto.response.RegisterResponse;
import com.sportify.sportifybackend.entity.EmailVerification;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.EmailVerificationRepository;
import com.sportify.sportifybackend.repository.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Duration;

import com.sportify.sportifybackend.dto.request.VerifyEmailRequest;
import org.springframework.web.server.ResponseStatusException;

import java.security.MessageDigest;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final EmailVerificationRepository verificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final VerificationCode verificationCode;
    private final ApplicationEventPublisher events;

    public AuthService(
            UserRepository userRepository,
            EmailVerificationRepository verificationRepository,
            PasswordEncoder passwordEncoder,
            VerificationCode verificationCode,
            ApplicationEventPublisher events
    ) {
        this.userRepository = userRepository;
        this.verificationRepository = verificationRepository;
        this.passwordEncoder = passwordEncoder;
        this.verificationCode = verificationCode;
        this.events = events;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        String email = request.email().strip().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Cet email est déjà utilisé."
            );
        }

        String password = request.password();
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Le mot de passe dépasse 72 octets."
            );
        }

        User user = userRepository.save(new User(
                request.firstName().strip(),
                request.lastName().strip(),
                email,
                passwordEncoder.encode(password)
        ));

        String code = verificationCode.generate();
        Instant issuedAt = Instant.now();

        verificationRepository.save(new EmailVerification(
                user,
                verificationCode.digest(user.getId(), code),
                issuedAt,
                issuedAt.plus(10, ChronoUnit.MINUTES)
        ));

        events.publishEvent(new VerificationCodeIssued(user.getId(), email, code));

        return new RegisterResponse(user.getId(), true);
    }
    public enum VerificationResult {
        VERIFIED,
        CODE_INCORRECT,
        CODE_EXPIRED,
        CODE_BLOCKED,
        NO_PENDING_VERIFICATION
    }

    @Transactional
    public VerificationResult verifyEmail(VerifyEmailRequest request) {
        EmailVerification verification = verificationRepository
                .findForVerification(request.userId())
                .orElse(null);

        if (verification == null) {
            return VerificationResult.NO_PENDING_VERIFICATION;
        }

        if (!Instant.now().isBefore(verification.getExpiresAt())) {
            return VerificationResult.CODE_EXPIRED;
        }

        if (verification.getFailedAttempts() >= 5) {
            return VerificationResult.CODE_BLOCKED;
        }

        String receivedDigest = verificationCode.digest(
                request.userId(), request.code()
        );

        boolean matches = MessageDigest.isEqual(
                verification.getCodeDigest().getBytes(StandardCharsets.US_ASCII),
                receivedDigest.getBytes(StandardCharsets.US_ASCII)
        );

        if (!matches) {
            verification.recordFailedAttempt();

            if (verification.getFailedAttempts() >= 5) {
                return VerificationResult.CODE_BLOCKED;
            }

            return VerificationResult.CODE_INCORRECT;
        }

        verification.getUser().markEmailVerified();
        verificationRepository.delete(verification);
        return VerificationResult.VERIFIED;
    }
    @Transactional
    public Duration resendCode(Long userId) {
        EmailVerification verification = verificationRepository
                .findForVerification(userId)
                .orElse(null);

        if (verification == null || verification.getUser().isEmailVerified()) {
            return Duration.ZERO;
        }

        Instant now = Instant.now();
        Duration delay = verification.delayBeforeResend(now);

        if (!delay.isZero()) {
            return delay;
        }

        String code;
        String digest;

        do {
            code = verificationCode.generate();
            digest = verificationCode.digest(userId, code);
        } while (digest.equals(verification.getCodeDigest()));

        verification.recordResend(digest, now);

        String email = verification.getUser().getEmail();
        events.publishEvent(new VerificationCodeIssued(userId, email, code));;

        return Duration.ZERO;
    }


    public record VerificationCodeIssued(Long userId, String email, String code) {}
}