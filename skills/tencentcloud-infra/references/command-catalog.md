# TencentCloud tccli Command Catalog

## Identity
```bash
tccli configure list
tccli sts GetCallerIdentity --profile <profile>
```

## CVM
```bash
tccli cvm DescribeInstances --region <region> --profile <profile>
tccli cvm StartInstances --region <region> --profile <profile> --InstanceIds '["ins-xxxx"]'
tccli cvm StopInstances --region <region> --profile <profile> --InstanceIds '["ins-xxxx"]'
tccli cvm RebootInstances --region <region> --profile <profile> --InstanceIds '["ins-xxxx"]'
```

## Lighthouse
```bash
tccli lighthouse DescribeInstances --region <region> --profile <profile>
tccli lighthouse StartInstances --region <region> --profile <profile> --InstanceIds '["lhins-xxxx"]'
tccli lighthouse StopInstances --region <region> --profile <profile> --InstanceIds '["lhins-xxxx"]'
tccli lighthouse RebootInstances --region <region> --profile <profile> --InstanceIds '["lhins-xxxx"]'
```

## VPC / Security Group
```bash
tccli vpc DescribeVpcs --region <region> --profile <profile>
tccli vpc DescribeSubnets --region <region> --profile <profile>
tccli vpc DescribeSecurityGroups --region <region> --profile <profile>
tccli vpc DescribeSecurityGroupPolicies --region <region> --profile <profile> --SecurityGroupId <sg-xxxx>
```

## CLB
```bash
tccli clb DescribeLoadBalancers --region <region> --profile <profile>
tccli clb DescribeListeners --region <region> --profile <profile> --LoadBalancerId <lb-xxxx>
tccli clb DescribeTargets --region <region> --profile <profile> --LoadBalancerId <lb-xxxx>
```

## TKE
```bash
tccli tke DescribeClusters --region <region> --profile <profile>
tccli tke DescribeClusterInstances --region <region> --profile <profile> --ClusterId <cls-xxxx>
tccli tke DescribeNodePools --region <region> --profile <profile> --ClusterId <cls-xxxx>
```

## CDB
```bash
tccli cdb DescribeDBInstances --region <region> --profile <profile>
```

## DNSPod
```bash
tccli dnspod DescribeDomainList --profile <profile>
tccli dnspod DescribeRecordList --profile <profile> --Domain <domain>
tccli dnspod CreateRecord --profile <profile> --Domain <domain> --SubDomain <rr> --RecordType <type> --RecordLine "default" --Value <value>
tccli dnspod ModifyRecord --profile <profile> --Domain <domain> --RecordId <recordId> --SubDomain <rr> --RecordType <type> --RecordLine "default" --Value <value>
tccli dnspod DeleteRecord --profile <profile> --Domain <domain> --RecordId <recordId>
```

## COS
```bash
# optional tool
coscmd ls

# tccli API style
tccli cos GetService --profile <profile>
```

## Mutating Operation Policy
For mutating commands:
1. Confirm profile + region + target resource.
2. Show exact command before execution.
3. Ask for explicit confirmation.
