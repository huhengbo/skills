# CAS Certificate Lifecycle and OSS Deployment

Use the sections below independently. Certificate application/renewal manages the certificate and domain validation only. OSS deployment takes an already issued or uploaded certificate and binds it to an existing OSS custom domain; it does not issue a certificate.

## Guardrails

- Resolve three profiles separately when needed: CAS/OSS, DNS, and an optional billing profile. Validate each identity with `aliyun sts GetCallerIdentity --profile <profile>` before mutation.
- Treat certificate request/renewal, DNS mutation, and deployment as independent mutating operations. Before each requested action, show redacted commands and receive explicit confirmation covering only its exact domain, product, DNS zone/record, OSS custom domain, and certificate/resource IDs.
- Never retrieve private-key content. Use `GetUserCertificateDetail --CertFilter true` for metadata only. Never use `--dryrun` for a signed-request preview because the CLI can print signed request material.
- A free personal test certificate is generally a replacement application, not a renewal of the expired certificate. Confirm that a three-month free certificate is acceptable before requesting it.
- Keep certificate diagnosis separate from application diagnosis. A valid, consistent TLS serial only establishes HTTPS transport; it does not prove that a single-page route, JavaScript bundle, API, or data source works.

## A. Certificate Application or Renewal

### A1. Inspect Before Changing Anything

Determine the account profiles and verify them. For a domain with separate DNS management, use the DNS profile only for Alidns calls.

```bash
aliyun sts GetCallerIdentity --profile <casProfile>
aliyun sts GetCallerIdentity --profile <dnsProfile>
aliyun cas ListUserCertificateOrder --OrderType CERT --Keyword <domain> --CurrentPage 1 --ShowSize 50 --profile <casProfile>
aliyun alidns DescribeDomainRecords --DomainName <registeredDomain> --profile <dnsProfile>
```

### A2. Request a Certificate

Use the appropriate request type:

- **Free personal test certificate:** use `CreateCertificateForPackageRequest` with `ProductCode digicert-free-1-free` and `ValidateType DNS` after confirmation.
- **Existing paid order:** inspect the order first; use `RenewCertificateOrderForPackageRequest` only after verifying that the order and product are eligible. Do not label a new free test certificate as a paid renewal.

Example planned request, with no real contact values in chat:

```bash
aliyun cas CreateCertificateForPackageRequest \
  --Domain <domain> \
  --ProductCode digicert-free-1-free \
  --ValidateType DNS \
  --Username <contactName> \
  --Email <contactEmail> \
  --Phone <contactPhone> \
  --profile <casProfile>
```

For an eligible paid order, the confirmed renewal request is:

```bash
aliyun cas RenewCertificateOrderForPackageRequest \
  --OrderId <orderId> \
  --profile <casProfile>
```

Record the returned order ID. Do not log or repeat contact details. Query the application state and use only the exact validation record returned by CAS:

```bash
aliyun cas DescribeCertificateState --OrderId <orderId> --profile <casProfile>
```

### A3. Write and Verify the DNS Challenge

Read the record name, value, and type from `DescribeCertificateState`; do not invent a TXT record from the certificate domain. If the authoritative DNS zone is managed in Alidns, first inspect existing records and then create the exact record:

```bash
aliyun alidns DescribeDomainRecords --DomainName <registeredDomain> --profile <dnsProfile>
aliyun alidns AddDomainRecord \
  --DomainName <registeredDomain> \
  --RR <relativeRecordName> \
  --Type TXT \
  --Value <casValidationValue> \
  --profile <dnsProfile>
```

For external DNS providers, present the record to the user and wait for confirmation that it has been created; do not claim it is verified. Re-query `DescribeCertificateState` until it reports a terminal result. Stop and report a failed/rejected state instead of retrying with a guessed record.

After issuance, obtain the certificate ID through a domain-filtered certificate listing. Confirm its status, domain, serial, and expiration without downloading private material:

```bash
aliyun cas ListUserCertificateOrder --OrderType CERT --Keyword <domain> --CurrentPage 1 --ShowSize 50 --profile <casProfile>
aliyun cas GetCertificateDetail --CertificateId <certificateId> --profile <casProfile>
aliyun cas GetUserCertificateDetail --CertId <certificateId> --CertFilter true --profile <casProfile>
```

## B. Deploy an Existing Certificate to OSS

Use this section only after the certificate already has a usable `certificateId`, whether it was just issued, previously issued, or uploaded to CAS. CAS deployment removes any need to download private-key material or manually use the OSS console. Discover the resource and an existing CAS contact, then confirm their returned IDs and labels match the intended target:

```bash
aliyun cas ListContact --CurrentPage 1 --ShowSize 50 --profile <casProfile>
aliyun cas ListCloudResources --CloudProduct OSS --Keyword <customDomain> --CurrentPage 1 --ShowSize 50 --profile <casProfile>
```

Create exactly one deployment job after confirmation. `resourceId` must be the ID from `ListCloudResources`, not a bucket name or DNS CNAME:

```bash
aliyun cas CreateDeploymentJob \
  --CertIds <certificateId> \
  --ContactIds <contactId> \
  --JobType OSS \
  --Name <deploymentName> \
  --ResourceIds <resourceId> \
  --profile <casProfile>
```

Use the returned job ID to inspect both job and worker state. A successful job is a control-plane result, not proof that every public edge is serving the new certificate.

```bash
aliyun cas DescribeDeploymentJob --JobId <jobId> --profile <casProfile>
aliyun cas DescribeDeploymentJobStatus --JobId <jobId> --profile <casProfile>
aliyun cas ListWorkerResource --JobId <jobId> --CloudProduct OSS --CurrentPage 1 --ShowSize 50 --profile <casProfile>
```

## C. Verify a Public TLS Endpoint

Use this check after any certificate deployment, regardless of the target product. Multiple serial numbers mean edge propagation is still mixed. Keep waiting and recheck; do not create duplicate jobs.

```bash
bash <skill-dir>/scripts/check_tls_certificate.sh \
  --host <customDomain> \
  --expected-serial <newCertificateSerial> \
  --samples 8 \
  --interval 5 \
  --require-valid
```

When all samples show one expected serial, verify the strict HTTPS response:

```bash
curl --noproxy '*' -4 -sSIL --fail https://<customDomain>/<path>
```

If TLS is consistent but the page is blank, inspect application routing and browser JavaScript errors. For a hash-based SPA URL, confirm that the exact fragment route is registered in the deployed bundle; the server never receives the fragment, so a valid certificate cannot repair an unregistered client route.
