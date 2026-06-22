# Aliyun CLI Command Catalog

## Identity and Auth
```bash
aliyun configure list
aliyun sts GetCallerIdentity --profile <profile>
```

## Billing
```bash
aliyun bssopenapi QueryAccountBalance --profile <profile>
aliyun bssopenapi QueryBillOverview --BillingCycle <YYYY-MM> --profile <profile>
aliyun bssopenapi QueryBill --BillingCycle <YYYY-MM> --PageNum 1 --PageSize 100 --profile <profile>
```

## SMS (Dysmsapi)
Use `references/sms.md` before sending SMS or querying SMS-specific approval and delivery state.

```bash
aliyun plugin install --names dysmsapi
aliyun dysmsapi query-sms-sign-list --api-version 2017-05-25 --page-index 1 --page-size 50 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi query-sms-template-list --api-version 2017-05-25 --page-index 1 --page-size 50 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi get-sms-sign --api-version 2017-05-25 --sign-name <signName> --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi get-sms-template --api-version 2017-05-25 --template-code <templateCode> --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi send-sms --api-version 2017-05-25 --phone-numbers <phoneNumbers> --sign-name <signName> --template-code <templateCode> --template-param <templateParamJson> --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi send-batch-sms --api-version 2017-05-25 --phone-number-json <phoneNumberJson> --sign-name-json <signNameJson> --template-code <templateCode> --template-param-json <templateParamJson> --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi query-send-details --api-version 2017-05-25 --phone-number <phoneNumber> --send-date <YYYYMMDD> --biz-id <bizId> --page-size 10 --current-page 1 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi query-send-statistics --api-version 2017-05-25 --is-globe 1 --start-date <YYYYMMDD> --end-date <YYYYMMDD> --page-index 1 --page-size 10 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi query-sms-qualification-record --api-version 2017-05-25 --page-no 1 --page-size 20 --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
aliyun dysmsapi query-single-sms-qualification --api-version 2017-05-25 --qualification-group-id <qualificationGroupId> --profile <profile> --user-agent AlibabaCloud-Agent-Skills/alibabacloud-sms-send-short-message --read-timeout 3
```

## ECS
```bash
aliyun ecs DescribeRegions --profile <profile>
aliyun ecs DescribeInstances --RegionId <region> --profile <profile>
aliyun ecs StartInstance --InstanceId <instanceId> --RegionId <region> --profile <profile>
aliyun ecs StopInstance --InstanceId <instanceId> --RegionId <region> --profile <profile>
aliyun ecs RebootInstance --InstanceId <instanceId> --RegionId <region> --profile <profile>
```

## OSS
```bash
aliyun oss ls --profile <profile>
aliyun oss ls oss://<bucket>/<path>/ --profile <profile>
```

## CDN
```bash
aliyun cdn DescribeUserDomains --profile <profile>
aliyun cdn DescribeCdnDomainDetail --DomainName <domain> --profile <profile>
aliyun cdn DescribeCdnDomainConfigs --DomainName <domain> --profile <profile>
aliyun cdn RefreshObjectCaches --ObjectPath "https://example.com/a.js" --ObjectType File --profile <profile>
aliyun cdn PushObjectCache --ObjectPath "https://example.com/a.js" --profile <profile>
```

## SAE
```bash
aliyun sae ListApplications --profile <profile>
aliyun sae DescribeApplicationStatus --AppId <appId> --profile <profile>
aliyun sae StartApplication --AppId <appId> --profile <profile>
aliyun sae StopApplication --AppId <appId> --profile <profile>
aliyun sae RestartApplication --AppId <appId> --profile <profile>
```

## ACK
```bash
aliyun cs DescribeClusters --profile <profile>
aliyun cs DescribeClusterDetail --ClusterId <clusterId> --profile <profile>
aliyun cs DescribeClusterNodePools --ClusterId <clusterId> --profile <profile>
```

## DevOps (Codeup)
```bash
aliyun devops ListJoinedOrganizations --profile <profile>
aliyun devops ListRepositories --organizationId <orgId> --profile <profile>
aliyun devops GetRepository --repositoryId <repoId> --profile <profile>
aliyun devops ListRepositoryBranches --repositoryId <repoId> --profile <profile>
aliyun devops ListRepositoryTags --repositoryId <repoId> --profile <profile>
```

## DNS (Alidns)
```bash
aliyun alidns DescribeDomains --profile <profile>
aliyun alidns DescribeDomainRecords --DomainName <domain> --profile <profile>
aliyun alidns AddDomainRecord --DomainName <domain> --RR <rr> --Type <type> --Value <value> --profile <profile>
aliyun alidns UpdateDomainRecord --RecordId <recordId> --RR <rr> --Type <type> --Value <value> --profile <profile>
aliyun alidns DeleteDomainRecord --RecordId <recordId> --profile <profile>
```

## VPC
```bash
aliyun vpc DescribeVpcs --RegionId <region> --profile <profile>
aliyun vpc DescribeVSwitches --RegionId <region> --profile <profile>
```

## RDS
```bash
aliyun rds DescribeDBInstances --RegionId <region> --profile <profile>
```

## Mutating Operation Policy
For mutating operations, always:
1. Confirm profile + region + target resource.
2. Show planned command.
3. Ask for explicit confirmation.

For SMS send operations, additionally confirm recipients, signature, template, template params, and billable external communication impact.
