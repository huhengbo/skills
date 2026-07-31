# Troubleshooting Guide

## Missing CLI
Symptom:
- `aliyun: command not found`

Action:
1. Install Aliyun CLI.
2. Verify with:
```bash
aliyun --version
```

## Missing Profile or Invalid Config
Symptom:
- `Profile not found`
- `load configure failed`

Action:
```bash
aliyun configure list
aliyun configure --profile <profile>
```

## Invalid Access Key
Symptom:
- `InvalidAccessKeyId`
- `SignatureDoesNotMatch`

Action:
1. Verify profile key pair.
2. Reconfigure profile.
3. Retry identity check:
```bash
aliyun sts GetCallerIdentity --profile <profile>
```

## Region Mismatch
Symptom:
- `InvalidRegionId.NotFound`
- Empty listing for expected resources

Action:
```bash
aliyun ecs DescribeRegions --profile <profile>
```
Then re-run with explicit `--RegionId <region>`.

## Permission Denied
Symptom:
- `NoPermission`
- `Forbidden`

Action:
1. Capture denied action from error.
2. Verify current identity:
```bash
aliyun sts GetCallerIdentity --profile <profile>
```
3. Request least-privilege RAM policy for the denied action.

## SMS Plugin or API Version Issue
Symptom:
- `unknown command "dysmsapi"`
- Missing SMS operations such as `send-sms`
- SMS request fails because `--api-version` is absent

Action:
```bash
aliyun version
aliyun configure set --auto-plugin-install true
aliyun plugin update
aliyun plugin install --names dysmsapi
aliyun dysmsapi send-sms --help
```
Use `--api-version 2017-05-25` for SMS commands.

## SMS Signature or Template Rejected
Symptom:
- `isv.SMS_SIGN_NAME_ILLEGAL`
- `isv.SMS_TEMPLATE_ILLEGAL`
- `SignatureNotFound`
- `TemplateNotFound`

Action:
1. Do not retry the send command with guessed values.
2. Ask the user whether to list approved signatures/templates.
3. Query candidates:
```bash
aliyun dysmsapi query-sms-sign-list --api-version 2017-05-25 --page-index 1 --page-size 50 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi query-sms-template-list --api-version 2017-05-25 --page-index 1 --page-size 50 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
```
4. Keep only `SignStatus = 1` and `TemplateStatus = 1`.

## SMS Delivery or Billing Confusion
Symptom:
- User asks whether a sent SMS arrived.
- Send response has `Code=OK`, but recipient did not receive the message.
- Error codes include `isv.AMOUNT_NOT_ENOUGH`, `isv.BUSINESS_LIMIT_CONTROL`, or `isv.MOBILE_NUMBER_ILLEGAL`.

Action:
1. Explain that `Code=OK` means gateway acceptance, not carrier delivery.
2. Query delivery details with `BizId` when available:
```bash
aliyun dysmsapi query-send-details --api-version 2017-05-25 --phone-number <phoneNumber> --send-date <YYYYMMDD> --biz-id <bizId> --page-size 10 --current-page 1 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
```
3. Use `ErrCode` and `SendStatus` from the details response for final triage.

## API Shape Changed
Symptom:
- Unknown parameter or invalid request body

Action:
```bash
aliyun <service> <operation> --help
```
Use latest help output to adjust parameters.

## CAS Command or Permission Issue
Symptom:
- `aliyun cas` says a certificate action is invalid or unavailable.
- `Forbidden` or `NoPermission` is returned while listing certificates, adding DNS records, or creating a deployment job.

Action:
1. Inspect the current command schema rather than guessing parameters:
```bash
aliyun cas --help
aliyun cas <ApiName> --help
```
2. Verify the CAS profile identity, then request the least-privilege CAS action shown in the error.
3. Verify the DNS profile independently if validation records are managed by a different account.
4. Do not switch to browser automation because of an OSS CLI profile issue; CAS deployment uses `aliyun cas` and does not require ossutil.

## OSSutil Profile Mismatch
Symptom:
- `aliyun ossutil` cannot find the requested profile, or accesses an unexpected OSS account or region.

Action:
1. Confirm that the command uses ossutil v2, not deprecated `aliyun oss`:
```bash
aliyun ossutil version
```
2. List profile names from ossutil's own configuration:
```bash
aliyun ossutil config list-profiles
```
3. Treat `--profile <ossutilProfile>` as a profile in `~/.ossutilconfig` (or the explicitly supplied `--config-file`), not as a guarantee that it maps to `aliyun configure --profile <profile>`.
4. If the required profile is absent, stop before creating one. Ask for confirmation of the account, region, and local configuration-file target; never print the configuration file or put access keys in a command line.

## CAS Certificate Detail May Contain a Private Key
Symptom:
- A certificate detail response includes `Key`, `PrivateKey`, or PEM content.

Action:
1. Stop forwarding or saving the response.
2. Re-run only the safe metadata query:
```bash
aliyun cas GetUserCertificateDetail --CertId <certificateId> --CertFilter true --profile <casProfile>
```
3. Summarize certificate ID, domain, status, serial, and expiry only. Never paste certificate private-key content into chat, logs, or a command preview.

## OSS Deployment Succeeds but TLS Is Still Expired or Inconsistent
Symptom:
- CAS reports the OSS deployment job succeeded.
- Strict HTTPS still fails, or repeated TLS handshakes return both old and new serial numbers.

Action:
1. Do not create a second deployment job or change DNS yet.
2. Sample the public endpoint repeatedly:
```bash
bash <skill-dir>/scripts/check_tls_certificate.sh \
  --host <customDomain> \
  --expected-serial <newCertificateSerial> \
  --samples 8 \
  --interval 5 \
  --require-valid
```
3. Wait until all samples report exactly one new serial number before running a strict request:
```bash
curl --noproxy '*' -4 -sSIL --fail https://<customDomain>/<path>
```
4. If the serial number is consistent but the page is blank, diagnose the application separately: inspect the HTTP response, JavaScript errors, and client-side route. Certificate replacement cannot fix a missing SPA route or runtime error.
