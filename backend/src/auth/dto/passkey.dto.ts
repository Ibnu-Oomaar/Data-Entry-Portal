import { IsObject, IsUUID } from 'class-validator';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

export class PasskeyAuthenticationDto {
  @IsUUID('4')
  flowId: string;

  @IsObject()
  response: AuthenticationResponseJSON;
}

export class PasskeyRegistrationDto {
  @IsUUID('4')
  flowId: string;

  @IsObject()
  response: RegistrationResponseJSON;
}
