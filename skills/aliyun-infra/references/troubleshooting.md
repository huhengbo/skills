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

## API Shape Changed
Symptom:
- Unknown parameter or invalid request body

Action:
```bash
aliyun <service> <operation> --help
```
Use latest help output to adjust parameters.
