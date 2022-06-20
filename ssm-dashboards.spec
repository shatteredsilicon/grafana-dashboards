%define debug_package %{nil}

%global provider        github
%global provider_tld	com
%global project         shatteredsilicon
%global repo            grafana-dashboards
%global provider_prefix	%{provider}.%{provider_tld}/%{project}/%{repo}

Name:		ssm-dashboards
Version:	%{_version}
Release:	5%{?dist}
Summary:	Grafana dashboards for MySQL and MongoDB monitoring using Prometheus

License:	AGPLv3
URL:		https://%{provider_prefix}
Source0:	%{name}-%{version}.tar.gz

BuildRequires:	nodejs
Requires:	grafana
Provides:	ssm-grafana-dashboards = %{version}-%{release}

%description
Grafana dashboards for MySQL and MongoDB monitoring using Prometheus.
This is a set of Grafana dashboards for database and system monitoring
using Prometheus datasource.
Dashboards are also a part of Percona Monitoring and Management project.


%prep
%setup -q -n %{name}


%build
pushd pmm-app
    npm run build
popd


%install
install -d %{buildroot}%{_datadir}/%{name}/ssm-app
cp -pa ./pmm-app/dist %{buildroot}%{_datadir}/%{name}/ssm-app
echo %{version} > %{buildroot}%{_datadir}/%{name}/VERSION


%files
%license LICENSE
%doc README.md LICENSE
%{_datadir}/%{name}


%changelog
* Wed Mar 14 2018 Mykola Marzhan <mykola.marzhan@percona.com> - 1.9.0-5
- use more new node_modules

* Tue Feb 13 2018 Mykola Marzhan <mykola.marzhan@percona.com> - 1.7.0-4
- PMM-2034 compile grafana app

* Mon Nov 13 2017 Mykola Marzhan <mykola.marzhan@percona.com> - 1.5.1-1
- PMM-1771 keep QAN Plugin in dashboards dir

* Mon Nov 13 2017 Mykola Marzhan <mykola.marzhan@percona.com> - 1.5.0-1
- PMM-1680 Include QAN Plugin into PMM

* Thu Feb  2 2017 Mykola Marzhan <mykola.marzhan@percona.com> - 1.1.0-1
- add build_timestamp to Release value

* Thu Dec 15 2016 Mykola Marzhan <mykola.marzhan@percona.com> - 1.0.7-1
- init version
