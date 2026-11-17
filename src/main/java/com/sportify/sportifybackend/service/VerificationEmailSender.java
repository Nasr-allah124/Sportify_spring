package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.service.AuthService.VerificationCodeIssued;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class VerificationEmailSender {

    private static final Logger logger =
            LoggerFactory.getLogger(VerificationEmailSender.class);

    private final JavaMailSender mailSender;
    private final String from;

    public VerificationEmailSender(
            JavaMailSender mailSender,
            @Value("${sportify.mail.from}") String from
    ) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendVerificationEmail(VerificationCodeIssued event) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(event.email());
        message.setSubject("Sportify — Vérifie ton adresse email");
        message.setText("""
            Bonjour,

            Ton code de vérification Sportify est : %s

            Il est valable 10 minutes.

            L'équipe Sportify
            """.formatted(event.code()));

        try {
            mailSender.send(message);
        } catch (MailException exception) {
            logger.warn(
                    "Échec de l’envoi du code de vérification Sportify ({})",
                    exception.getClass().getSimpleName()
            );
        }
    }
}