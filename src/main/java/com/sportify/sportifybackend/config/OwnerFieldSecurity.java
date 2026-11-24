package com.sportify.sportifybackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;

@Configuration
public class OwnerFieldSecurity {

    @Bean
    @Order(1)
    SecurityFilterChain ownerFieldEndpoints(HttpSecurity http) throws Exception {
        var paths = PathPatternRequestMatcher.withDefaults();

        var oldCreate = paths.matcher(HttpMethod.POST, "/api/v1/owner/complexes");
        var fields = paths.matcher("/api/v1/owner/fields");
        var photos = paths.matcher("/api/v1/field-photos/**");
        var decision = paths.matcher("/api/v1/admin/owner-applications/*/decision");
        var management = paths.matcher(
                HttpMethod.GET, "/api/v1/owner/fields/management"
        );
        var fieldState = paths.matcher(
                HttpMethod.PUT, "/api/v1/owner/fields/{id}/state"
        );
        var editRead = paths.matcher(
                HttpMethod.GET, "/api/v1/owner/fields/{id}/details"
        );
        var editWrite = paths.matcher(
                HttpMethod.PUT, "/api/v1/owner/fields/{id}/details"
        );

        return http
                .securityMatcher(new OrRequestMatcher(
                        oldCreate, fields, management, fieldState,
                        editRead, editWrite, photos, decision
                ))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.ignoringRequestMatchers(
                        fields, fieldState, editWrite, decision
                ))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(photos).permitAll()
                        .requestMatchers(oldCreate).denyAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(resource -> resource.jwt(Customizer.withDefaults()))
                .build();
    }
}