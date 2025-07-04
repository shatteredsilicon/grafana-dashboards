import React, { useEffect, useState } from "react";
import { useForm, Form } from "react-hook-form";
import { Legend, Field, Input, Button, RadioButtonGroup, Combobox } from "@grafana/ui";
import { Instance } from "../types";
import { ElementProps } from "panels/types";

export const AddSNMP: React.FC<ElementProps> = ({ onSizeChange }) => {
  const { control, register, formState: { errors, isValidating }, clearErrors, setValue } = useForm<SNMPInstance>({});

  const [snmpVersion, setSNMPVersion] = useState<SNMPVersion>();
  const [snmpSecurityLevel, setSNMPSecurityLevel] = useState<SNMPSecurityLevel>();

  enum SNMPVersion {
    v1 = '1',
    v2c = '2',
    v3 = '3'
  }

  enum SNMPSecurityLevel {
    noAuthNoPriv = 'noAuthNoPriv',
    authNoPriv = 'authNoPriv',
    authPriv = 'authPriv'
  }

  enum SNMPAuthProtocol {
    md5 = 'MD5',
    sha224 = 'SHA-224',
    sha256 = 'SHA-256',
    sha384 = 'SHA-384',
    sha512 = 'SHA-512'
  }

  enum SNMPPrivacyProtocol {
    des = 'DES',
    aes = 'AES',
    aes192 = 'AES-192',
    sha256 = 'SHA-256'
  }

  interface SNMPInstance extends Instance {
    version: SNMPVersion;
    community?: string;
    securityLevel?: SNMPSecurityLevel;
    authProtocol?: SNMPAuthProtocol;
    username?: string;
    password?: string;
    privacyProtocol?: SNMPPrivacyProtocol;
    contextName?: string;
  }

  const defaultCommunity = 'public';

  useEffect(() => {
    onSizeChange();
  }, [errors, isValidating, snmpVersion, snmpSecurityLevel])

  function postInstance(instance: SNMPInstance) {
    const currentUrl = `${window.parent.location}`;
    const newURL = currentUrl.split('/graph/d/').shift() + '/graph/d/ssm-list/';

    instance.community = (instance.community === undefined || instance.community === '') ? defaultCommunity : instance.community;
    instance.name = (instance.name === undefined || instance.name === '') ? instance.address : instance.name;
    fetch(`/managed/v0/snmp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify((Object.keys(instance) as Array<keyof SNMPInstance>).reduce((acc, key) => {
        acc[key.replace(/([A-Z])/g, '_$1')] = instance[key];
        return acc;
      }, {} as { [key: string]: any }))
    })
      .then(res => res.ok && window.parent.location.assign(newURL));
  }

  return (
    <div style={{ maxWidth: '600px', width: '100%' }}>
      <Form<SNMPInstance>
        control={control}
        onSubmit={payload => postInstance(payload.data)}
      >
        <Legend>Add remote SNMP Instance</Legend>
        <Field label='Hostname' required invalid={errors.address !== undefined} error={errors.address?.message}>
          <Input {...register('address', { required: 'Hostname is required' })} placeholder='Hostname' />
        </Field>
        <Field label='Name'>
          <Input {...register('name')} placeholder='Name (default: Hostname)' />
        </Field>
        <Field label='Port'>
          <Input {...register('port')} defaultValue={161} placeholder='Port (default: 161)' type='number' />
        </Field>
        <Field label='Version' required invalid={errors.version !== undefined} error={errors.version?.message}>
          <RadioButtonGroup
            {...register('version', { required: 'Version is required' })}
            options={(() => {
              const versions = [];
              for (let version in SNMPVersion) {
                const v = SNMPVersion[version as keyof typeof SNMPVersion];

                versions.push({
                  label: version.startsWith('v') ? version.slice(1) : version,
                  value: v
                });
              }
              return versions
            })()}
            onChange={v => { setSNMPVersion(v); setValue('version', v); clearErrors('version'); }}
            value={snmpVersion}
          />
        </Field>
        {snmpVersion &&
          (
            snmpVersion === '3'
              ? <>
                <Field label='Security Level' required invalid={errors.securityLevel !== undefined} error={errors.securityLevel?.message}>
                  <RadioButtonGroup
                    {...register('securityLevel', { required: 'Security Level is required' })}
                    options={(() => {
                      const levels = [];
                      for (let level in SNMPSecurityLevel) {
                        const l = SNMPSecurityLevel[level as keyof typeof SNMPSecurityLevel]
                        levels.push({
                          label: l,
                          value: l
                        });
                      }
                      return levels
                    })()}
                    onChange={v => { setSNMPSecurityLevel(v); setValue('securityLevel', v); clearErrors('securityLevel'); }}
                    value={snmpSecurityLevel}
                  />
                </Field>
                {(snmpSecurityLevel === SNMPSecurityLevel.authPriv || snmpSecurityLevel === SNMPSecurityLevel.authNoPriv) &&
                  <Field label='Authorization Protocol' required invalid={errors.authProtocol !== undefined} error={errors.authProtocol?.message}>
                    <Combobox
                      {...register('authProtocol', { required: 'Authorization Protocol is required' })}
                      placeholder='Please select the SNMP authentication protocol'
                      options={(() => {
                        const protocols = [];
                        for (let protocol in SNMPAuthProtocol) {
                          const p = SNMPAuthProtocol[protocol as keyof typeof SNMPAuthProtocol]
                          protocols.push({
                            label: p,
                            value: p
                          });
                        }
                        return protocols
                      })()}
                      onChange={v => { setValue('authProtocol', v.value); clearErrors('authProtocol'); }}
                      onBlur={() => { }}
                    />
                  </Field>
                }
                <Field label='Username' required invalid={errors.username !== undefined} error={errors.username?.message}>
                  <Input {...register('username', { required: 'Username is required' })} placeholder='Username' />
                </Field>
                {(snmpSecurityLevel === SNMPSecurityLevel.authPriv || snmpSecurityLevel === SNMPSecurityLevel.authNoPriv) &&
                  <Field label='Password' required invalid={errors.password !== undefined} error={errors.password?.message}>
                    <Input {...register('password', { required: 'Password is required' })} placeholder='Password' />
                  </Field>
                }
                {snmpSecurityLevel === SNMPSecurityLevel.authPriv &&
                  <Field label='Privacy Protocol' required invalid={errors.privacyProtocol !== undefined} error={errors.privacyProtocol?.message}>
                    <Combobox
                      {...register('privacyProtocol', { required: 'Privacy Protocol is required' })}
                      placeholder='Please select the SNMP privacy protocol'
                      options={(() => {
                        const protocols = [];
                        for (let protocol in SNMPPrivacyProtocol) {
                          const p = SNMPPrivacyProtocol[protocol as keyof typeof SNMPPrivacyProtocol]
                          protocols.push({
                            label: p,
                            value: p
                          });
                        }
                        return protocols
                      })()}
                      onChange={v => { setValue('privacyProtocol', v.value); clearErrors('privacyProtocol'); }}
                      onBlur={() => { }}
                    />
                  </Field>
                }
                <Field label='Context Name' required invalid={errors.contextName !== undefined} error={errors.contextName?.message}>
                  <Input {...register('contextName', { required: 'Context Name is required' })} placeholder='Context Name' />
                </Field>
              </>
              : <Field label='Community'>
                  <Input {...register('community')} placeholder='Community (default: public)' />
                </Field>
          )
        }
        <Field>
          <Button type="submit">Add Instance</Button>
        </Field>
      </Form>
    </div>
  );
}