import React, { useEffect } from "react";
import { useForm, Form } from "react-hook-form";
import { Legend, Field, Input, Button } from "@grafana/ui";
import { RemoteInstance } from "../types";
import { ElementProps } from "panels/types";

export const AddPostgreSQL: React.FC<ElementProps> = ({onSizeChange}) => {
  const { control, register, formState: { errors, isValidating } } = useForm<RemoteInstance>({});

  useEffect(()=>{
    onSizeChange();
  }, [errors, isValidating])

  function postInstance(instance: RemoteInstance) {
      const currentUrl = `${window.parent.location}`;
      const newURL = currentUrl.split('/graph/d/').shift() + '/graph/d/ssm-list/';
  
      fetch(`/managed/v0/postgresql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(instance)
      })
        .then(res => res.ok && window.parent.location.assign(newURL));
    }

  return (
    <div style={{maxWidth: '600px', width:'100%'}}>
      <Form<RemoteInstance>
        control={control}
        onSubmit={payload => postInstance(payload.data)}
      >
        <Legend>Add remote PostgreSQL Instance</Legend>
        <Field label='Hostname' required invalid={errors.address !== undefined} error={errors.address?.message}>
          <Input {...register('address', { required: 'Hostname is required' })} placeholder='Hostname' />
        </Field>
        <Field label='Name'>
          <Input {...register('name')} placeholder='Name (default: Hostname)' />
        </Field>
        <Field label='Port'>
          <Input {...register('port')} defaultValue={5432} placeholder='Port (default: 5432)' type='number' />
        </Field>
        <Field label='Username' required invalid={errors.username !== undefined} error={errors.username?.message}>
          <Input {...register('username', { required: 'Username is required' })} placeholder='Username' />
        </Field>
        <Field label='Password' required invalid={errors.password !== undefined} error={errors.password?.message}>
          <Input {...register('password', { required: 'Password is required' })} placeholder='Password' type='password' />
        </Field>
        <Field>
          <Button type="submit">Add Instance</Button>
        </Field>
      </Form>
    </div>
  );
}