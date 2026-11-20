package com.sportify.sportifybackend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;

@Component
public class GoogleIdentityVerifier {

    private static final Set<String> ISSUERS = Set.of(
            "https://accounts.google.com",
            "accounts.google.com"
    );

    private final String clientId;
    private final NimbusJwtDecoder decoder;

    public GoogleIdentityVerifier(
            @Value("${sportify.google.client-id}") String clientId
    ) {
        this.clientId = clientId;
        this.decoder = NimbusJwtDecoder
                .withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                .build();
    }

    public record Identity(
            String subject,
            String email,
            String firstName,
            String lastName,
            boolean googleControlsEmail
    ) {}

    public Identity verify(String credential) {
        Jwt jwt = decoder.decode(credential);

        String issuer = jwt.getClaimAsString("iss");
        String subject = jwt.getSubject();
        String email = jwt.getClaimAsString("email");

        if (issuer == null || !ISSUERS.contains(issuer)
                || jwt.getAudience() == null || !jwt.getAudience().contains(clientId)
                || jwt.getExpiresAt() == null || !jwt.getExpiresAt().isAfter(Instant.now())
                || subject == null || subject.isBlank()
                || email == null || email.isBlank()
                || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
            throw new BadJwtException("Identité Google invalide.");
        }

        email = email.strip().toLowerCase(Locale.ROOT);
        String hostedDomain = jwt.getClaimAsString("hd");
        boolean controlsEmail = email.endsWith("@gmail.com")
                || (hostedDomain != null && !hostedDomain.isBlank());

        return new Identity(
                subject, email,
                jwt.getClaimAsString("given_name"),
                jwt.getClaimAsString("family_name"),
                controlsEmail
        );
    }
}