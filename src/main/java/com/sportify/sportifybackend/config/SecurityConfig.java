package com.sportify.sportifybackend.config;

import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                String[] publicAuthRoutes = {
                                "/api/v1/auth/register",
                                "/api/v1/auth/verify-email",
                                "/api/v1/auth/resend-code",
                                "/api/v1/auth/login",
                                "/api/v1/auth/google"
                };

                JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
                roles.setAuthoritiesClaimName("roles");
                roles.setAuthorityPrefix("ROLE_");

                JwtAuthenticationConverter authentication = new JwtAuthenticationConverter();
                authentication.setJwtGrantedAuthoritiesConverter(roles);

                return http
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .csrf(csrf -> csrf
                                                .ignoringRequestMatchers(publicAuthRoutes)
                                                .ignoringRequestMatchers(
                                                                "/api/v1/reservations",
                                                                "/api/v1/reservations/*/cancel"))
                                .authorizeHttpRequests(auth -> auth
                                                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                                                .requestMatchers(HttpMethod.POST, publicAuthRoutes).permitAll()
                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/v1/complexes",
                                                                "/api/v1/fields",
                                                                "/api/v1/complexes/{id}/photos/{position}",
                                                                "/api/v1/fields/{id}")
                                                .permitAll().requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                                                .anyRequest().authenticated())
                                .oauth2ResourceServer(resource -> resource
                                                .jwt(jwt -> jwt.jwtAuthenticationConverter(authentication)))
                                .build();
        }
}