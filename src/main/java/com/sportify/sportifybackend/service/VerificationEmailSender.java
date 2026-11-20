package com.sportify.sportifybackend.service;

import com.sportify.sportifybackend.service.AuthService.VerificationCodeIssued;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class VerificationEmailSender {

    private static final Logger logger =
            LoggerFactory.getLogger(VerificationEmailSender.class);

    private final JavaMailSender mailSender;
    private final String from;
    private final String frontendUrl;
    private final String htmlTemplate;

    public VerificationEmailSender(
            JavaMailSender mailSender,
            @Value("${sportify.mail.from}") String from,
            @Value("${sportify.frontend-url}") String frontendUrl,
            @Value("classpath:mail/verification-email.html") Resource template
    ) throws IOException {
        this.mailSender = mailSender;
        this.from = from;
        this.frontendUrl = frontendUrl;
        this.htmlTemplate = template.getContentAsString(StandardCharsets.UTF_8);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendVerificationEmail(VerificationCodeIssued event) {
        String verificationUrl = UriComponentsBuilder
                .fromUriString(frontendUrl)
                .pathSegment("register")
                .queryParam("verify", event.userId())
                .build()
                .toUriString();

        String html = htmlTemplate
                .replace("{{CODE}}", HtmlUtils.htmlEscape(event.code()))
                .replace("{{VERIFY_URL}}", HtmlUtils.htmlEscape(verificationUrl));

        String plainText = """
                Vérifiez votre adresse email Sportify

                Votre code de vérification : %s
                Il est valable pendant 10 minutes.

                Saisissez-le sur cette page :
                %s

                Si vous avez demandé plusieurs codes, utilisez le dernier reçu.
                Si vous n’avez pas demandé ce code, vous pouvez ignorer ce message.

                L’équipe Sportify
                """.formatted(event.code(), verificationUrl);

        try {
            MimeMessage message = mailSender.createMimeMessage();

            MimeMessageHelper helper = new MimeMessageHelper(
                    message, true, StandardCharsets.UTF_8.name()
            );

            helper.setFrom(from, "Sportify");
            helper.setTo(event.email());
            helper.setSubject("Votre code de vérification Sportify");
            helper.setText(plainText, html);

            mailSender.send(message);
        } catch (MessagingException | MailException | IOException exception) {
            logger.warn(
                    "Échec de l’envoi du mail de vérification Sportify ({})",
                    exception.getClass().getSimpleName()
            );
        }
    }
}