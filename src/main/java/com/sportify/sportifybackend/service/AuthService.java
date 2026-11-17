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

        events.publishEvent(new VerificationCodeIssued(email, code));

        return new RegisterResponse(user.getId(), true);
    }
    @Transactional
    public boolean verifyEmail(VerifyEmailRequest request) {
        EmailVerification verification = verificationRepository
                .findForVerification(request.userId())
                .orElse(null);

        if (verification == null
                || !Instant.now().isBefore(verification.getExpiresAt())
                || verification.getFailedAttempts() >= 5) {
            return false;
        }

        String expectedDigest = verification.getCodeDigest();
        String receivedDigest = verificationCode.digest(
                request.userId(), request.code()
        );

        boolean matches = MessageDigest.isEqual(
                expectedDigest.getBytes(StandardCharsets.US_ASCII),
                receivedDigest.getBytes(StandardCharsets.US_ASCII)
        );

        if (!matches) {
            verification.recordFailedAttempt();
            return false;
        }

        verification.getUser().markEmailVerified();
        verificationRepository.delete(verification);
        return true;
    }


    public record VerificationCodeIssued(String email, String code) {}
}