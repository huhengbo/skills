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
