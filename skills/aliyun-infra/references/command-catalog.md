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
