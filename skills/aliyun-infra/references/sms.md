# SMS / Dysmsapi Operations

Use this reference for Alibaba Cloud Short Message Service requests: sending SMS, batch sending, listing or checking signatures/templates, querying qualification records, delivery details, and send statistics.

Source alignment: based on the Alibaba Cloud official `alibabacloud-sms-send-short-message` skill scope, public portal metadata, and CLI examples inspected on 2026-06-22. The official skill covers `SendSms`, `SendBatchSms`, SMS qualification, signature/template queries, send records, and send statistics.

## CLI Compliance

For SMS commands, use Aliyun CLI with the `dysmsapi` plugin:

```bash
aliyun version
aliyun configure set --auto-plugin-install true
aliyun plugin update
aliyun plugin install --names dysmsapi
```

When following Alibaba Cloud Agent Skill compliance, enable CLI AI mode before SMS operations:

```bash
aliyun configure ai-mode enable
aliyun configure ai-mode set-user-agent --user-agent "AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message"
```

Disable CLI AI mode before the final response or any other exit point:

```bash
aliyun configure ai-mode disable
```

Every SMS command should include:
- `--api-version 2017-05-25`
- `--user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message`
- `--read-timeout 3`
- `--profile <profile>` when the environment has more than one account

## Safety Rules

- Treat `send-sms` and `send-batch-sms` as billable external communications.
- Never guess `sign-name`, `template-code`, template variables, or phone numbers.
- Never send to placeholder numbers copied from examples.
- Require explicit phone numbers from the user before any send operation.
- Restate the full send plan and wait for explicit confirmation before sending.
- Mask phone numbers in summaries, for example `138****8000`.
- Do not retry send commands blindly after timeout; query delivery records first.
- `Code=OK` only means the SMS gateway accepted the request. It is not proof of delivery.
- Use `query-send-details` with `BizId` when the user asks whether a message arrived.

## Parameter Discovery

If the user has not provided a signature or template, ask whether to list approved candidates. After consent, use:

```bash
aliyun dysmsapi query-sms-sign-list \
  --api-version 2017-05-25 \
  --page-index 1 --page-size 50 \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3

aliyun dysmsapi query-sms-template-list \
  --api-version 2017-05-25 \
  --page-index 1 --page-size 50 \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3
```

Filter candidates to approved items:
- `SignStatus = 1`
- `TemplateStatus = 1`

For signatures, surface carrier registration details when available, but do not reject a signature only because one carrier registration is not complete.

For a selected candidate, inspect exact status:

```bash
aliyun dysmsapi get-sms-sign \
  --api-version 2017-05-25 \
  --sign-name "<signName>" \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3

aliyun dysmsapi get-sms-template \
  --api-version 2017-05-25 \
  --template-code "<templateCode>" \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3
```

If template content contains `${variable}` placeholders, collect every variable value and assemble `--template-param` JSON.

## Send SMS

Use `send-sms` when all recipients share the same signature, template, and template params. It supports up to 1000 phone numbers.

```bash
aliyun dysmsapi send-sms \
  --api-version 2017-05-25 \
  --phone-numbers "<phoneNumbers>" \
  --sign-name "<signName>" \
  --template-code "<templateCode>" \
  --template-param '<templateParamJson>' \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3
```

Use `send-batch-sms` only when each recipient needs different signature or template params. It supports up to 100 phone numbers.

```bash
aliyun dysmsapi send-batch-sms \
  --api-version 2017-05-25 \
  --phone-number-json '["<phone1>","<phone2>"]' \
  --sign-name-json '["<sign1>","<sign2>"]' \
  --template-code "<templateCode>" \
  --template-param-json '[{"code":"<value1>"},{"code":"<value2>"}]' \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3
```

Return `BizId` and `RequestId` when available. Do not claim delivery unless delivery details confirm it.

## Delivery Details and Statistics

For delivery details:

```bash
aliyun dysmsapi query-send-details \
  --api-version 2017-05-25 \
  --phone-number "<phoneNumber>" \
  --send-date "<YYYYMMDD>" \
  --biz-id "<bizId>" \
  --page-size 10 --current-page 1 \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3
```

For aggregated statistics:

```bash
aliyun dysmsapi query-send-statistics \
  --api-version 2017-05-25 \
  --is-globe 1 \
  --start-date "<YYYYMMDD>" \
  --end-date "<YYYYMMDD>" \
  --page-index 1 --page-size 10 \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3
```

`--is-globe` values:
- `1`: domestic SMS
- `2`: international, Hong Kong, Macao, and Taiwan SMS

`query-send-details` is for per-message delivery troubleshooting. `query-send-statistics` is for daily aggregate reporting.

## Qualification Queries

Use qualification queries when the user asks about SMS qualification status or business qualification records:

```bash
aliyun dysmsapi query-sms-qualification-record \
  --api-version 2017-05-25 \
  --page-no 1 --page-size 20 \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3

aliyun dysmsapi query-single-sms-qualification \
  --api-version 2017-05-25 \
  --qualification-group-id <qualificationGroupId> \
  --profile <profile> \
  --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message \
  --read-timeout 3
```

## Common Business Errors

| Error code | Meaning | Action |
| --- | --- | --- |
| `isv.SMS_SIGN_NAME_ILLEGAL` | Signature missing or unapproved | Query signatures and pick an approved one |
| `isv.SMS_TEMPLATE_ILLEGAL` | Template missing or unapproved | Query templates and pick an approved one |
| `isv.SMS_SIGNATURE_SCENE_ILLEGAL` | Signature/template scene mismatch | Use matching signature and template scenes |
| `isv.MOBILE_NUMBER_ILLEGAL` | Bad phone number format | Check and correct recipient numbers |
| `isv.AMOUNT_NOT_ENOUGH` | Insufficient balance | Ask the user to top up or change account |
| `isv.BUSINESS_LIMIT_CONTROL` | Rate or business limit triggered | Reduce send rate and inspect policy |
| `SignatureNotFound` | Signature not found | Create or select an existing signature |
| `TemplateNotFound` | Template not found | Create or select an existing template |
