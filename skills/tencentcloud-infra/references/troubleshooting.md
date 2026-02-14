# Troubleshooting Guide

## Missing CLI
Symptom:
- `tccli: command not found`

Action:
1. Install TencentCloud CLI.
2. Verify:
```bash
tccli --version
```

## Missing Profile
Symptom:
- `profile not found`
- `InvalidProfile`

Action:
```bash
tccli configure list
tccli configure set --profile <profile>
```

## Auth Failure
Symptom:
- `AuthFailure.*`
- `InvalidCredential`

Action:
1. Re-check profile credentials.
2. Run identity validation:
```bash
tccli sts GetCallerIdentity --profile <profile>
```

## Region Error
Symptom:
- `InvalidParameterValue.Region` or resource not found in expected location

Action:
1. Re-run with explicit `--region`.
2. Confirm service/region availability.

## Permission Denied
Symptom:
- `UnauthorizedOperation`
- `OperationDenied`

Action:
1. Capture denied action and resource scope.
2. Request least-privilege CAM policy update.
3. Retry read-only diagnostic first.

## API Parameter Drift
Symptom:
- Unknown parameter or changed parameter names

Action:
```bash
tccli <service> <Action> --help
```
Use current help output to correct parameters.
