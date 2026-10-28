'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { FieldError, FieldValues, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Button } from '@/components/atoms';
import { Alert } from '@/components/atoms/Alert/Alert';
import { LabeledInput } from '@/components/cells';
import { login } from '@/lib/data/customer';
import { toast } from '@/lib/helpers/toast';
import { tenantInternalPath } from '@/lib/helpers/safe-redirect';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { useTenantSlug } from '@/components/providers';

import { LoginFormData, loginFormSchema } from './schema';

export const LoginForm = () => {
  const methods = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <Form />
    </FormProvider>
  );
};

const Form = () => {
  const [isAuthError, setIsAuthError] = useState(false);
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = useFormContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = useTenantSlug();
  const isSessionExpired = searchParams.get('sessionExpired') === 'true';
  const isSessionRequired = searchParams.get('sessionRequired') === 'true';
  const redirectTo = tenantInternalPath(tenantSlug, searchParams.get('redirect'));

  const submit = async (data: FieldValues) => {
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);

    const res = await login(formData);

    if (res.success) {
      router.replace(redirectTo);
      router.refresh();
    } else {
      toast.error({ title: res.message || 'An error occurred. Please try again.' });
    }

    setIsAuthError(false);
  };

  const clearApiError = () => {
    isAuthError && setIsAuthError(false);
  };

  const getAuthMessage = () => {
    if (isSessionExpired) {
      return 'Your session has expired. Please log in to continue.';
    }
    if (isSessionRequired) {
      return 'Please log in to continue.';
    }
    return null;
  };

  const authMessage = getAuthMessage();

  return (
    <main
      className="container"
      data-testid="login-page"
    >
      <div className="mx-auto mt-6 w-full max-w-xl space-y-4">
        {authMessage && (
          <Alert
            title={authMessage}
            className="w-full"
            icon
            data-testid="login-auth-alert"
          />
        )}
        <div
          className="rounded-sm border p-4"
          data-testid="login-form-container"
        >
          <h1 className="heading-md mb-8 uppercase text-primary">Log in</h1>
          <form
            onSubmit={handleSubmit(submit)}
            data-testid="login-form"
          >
            <div className="space-y-4">
              <LabeledInput
                label="E-mail"
                placeholder="Your e-mail address"
                error={
                  (errors.email as FieldError) ||
                  (isAuthError ? ({ message: '' } as FieldError) : undefined)
                }
                data-testid="login-email-input"
                {...register('email', {
                  onChange: clearApiError
                })}
              />
              <LabeledInput
                label="Password"
                placeholder="Your password"
                type="password"
                error={
                  (errors.password as FieldError) ||
                  (isAuthError ? ({ message: '' } as FieldError) : undefined)
                }
                data-testid="login-password-input"
                {...register('password', {
                  onChange: clearApiError
                })}
              />
            </div>

            <LocalizedClientLink
              href="/forgot-password"
              className="label-md mt-4 block text-right uppercase text-action-on-secondary"
              data-testid="login-forgot-password-link"
            >
              Forgot your password?
            </LocalizedClientLink>

            <Button
              className="mt-8 w-full uppercase"
              disabled={isSubmitting}
              data-testid="login-submit-button"
            >
              Log in
            </Button>
          </form>
        </div>

        <div className="rounded-sm border p-4">
          <h2 className="heading-md mb-4 uppercase text-primary">
            Don&apos;t have an account yet?
          </h2>
          <LocalizedClientLink
            href={`/register?redirect=${encodeURIComponent(redirectTo)}`}
            data-testid="login-register-link"
          >
            <Button
              variant="tonal"
              className="mt-8 flex w-full justify-center uppercase"
            >
              Create account
            </Button>
          </LocalizedClientLink>
        </div>
      </div>
    </main>
  );
};
