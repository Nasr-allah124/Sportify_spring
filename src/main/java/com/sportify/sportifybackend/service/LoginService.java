package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.config.JwtConfig;
import com.sportify.sportifybackend.dto.request.LoginRequest;
import com.sportify.sportifybackend.dto.response.LoginResponse;
import com.sportify.sportifybackend.entity.User;
import com.sportify.sportifybackend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class LoginService {

    private static final Duration TOKEN_LIFETIME = Duration.ofMinutes(30);

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtEncoder encoder;
    private final String dummyHash;

    public LoginService(UserRepository users, PasswordEncoder passwords, JwtEncoder encoder) {
        this.users = users;
        this.passwords = passwords;
        this.encoder = encoder;
        this.dummyHash = passwords.encode(UUID.randomUUID().toString());
    }

    public enum Failure {
        INVALID_CREDENTIALS,
        ACCOUNT_DISABLED,
        EMAIL_NOT_VERIFIED,
        ACCOUNT_ALREADY_EXISTS,
        EMAIL_VERIFICATION_REQUIRED
    }

    public static class LoginRejected extends RuntimeException {
        private final Failure failure;
        private final Long userId;

        public LoginRejected(Failure failure, Long userId) {
            this.failure = failure;
            this.userId = userId;
        }

        public Failure getFailure() { return failure; }
        public Long getUserId() { return userId; }
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        String password = request.password();

        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new LoginRejected(Failure.INVALID_CREDENTIALS, null);
        }

        User user = users.findByEmail(email).orElse(null);
        String hash = user == null ? dummyHash : user.getPasswordHash();
        boolean matches = passwords.matches(password, hash);

        if (!matches || user == null) {
            throw new LoginRejected(Failure.INVALID_CREDENTIALS, null);
        }
        if (!user.isEnabled()) {
            throw new LoginRejected(Failure.ACCOUNT_DISABLED, null);
        }
        if (!user.isEmailVerified()) {
            throw new LoginRejected(Failure.EMAIL_NOT_VERIFIED, user.getId());
        }
        return issueToken(user);


    }
    private LoginResponse issueToken(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(TOKEN_LIFETIME);

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(JwtConfig.ISSUER)
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("roles", List.of(user.getRole().name()))
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims))
                .getTokenValue();

        return new LoginResponse(token, expiresAt);
    }
    @Transactional
    public LoginResponse loginWithGoogle(GoogleIdentityVerifier.Identity identity) {
        User user = users.findByGoogleSubject(identity.subject()).orElse(null);

        if (user == null) {
            if (users.existsByEmail(identity.email())) {
                throw new LoginRejected(Failure.ACCOUNT_ALREADY_EXISTS, null);
            }

            if (!identity.googleControlsEmail()) {
                throw new LoginRejected(Failure.EMAIL_VERIFICATION_REQUIRED, null);
            }

            String firstName = identity.firstName() == null ? "" : identity.firstName().strip();
            String lastName = identity.lastName() == null ? "" : identity.lastName().strip();

            // Le schéma actuel impose un password_hash pour chaque utilisateur.
            String randomPasswordHash = passwords.encode(UUID.randomUUID().toString());

            user = new User(
                    firstName.substring(0, Math.min(firstName.length(), 100)),
                    lastName.substring(0, Math.min(lastName.length(), 100)),
                    identity.email(),
                    randomPasswordHash
            );

            user.linkGoogleIdentity(identity.subject());
            user.markEmailVerified();
            user = users.saveAndFlush(user);
        }

        if (!user.isEnabled()) {
            throw new LoginRejected(Failure.ACCOUNT_DISABLED, null);
        }

        return issueToken(user);
    }



}