# Dashtock — AWS deploy tek kaynak (IP burada guncellenir)
# Ornek: $env:DASHTOCK_AWS_IP = "13.60.207.1"

$script:DashtockAwsIp = if ($env:DASHTOCK_AWS_IP) { $env:DASHTOCK_AWS_IP.Trim() } else { "13.60.207.1" }
$script:DashtockAwsUser = if ($env:DASHTOCK_AWS_USER) { $env:DASHTOCK_AWS_USER.Trim() } else { "ubuntu" }
$script:DashtockAwsServer = "${script:DashtockAwsUser}@${script:DashtockAwsIp}"
