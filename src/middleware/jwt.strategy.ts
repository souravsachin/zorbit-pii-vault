/**
 * Local JwtStrategy — pre-EPIC-9 form (DI workaround for SDK ZorbitJwtStrategy).
 */
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: string;
  org: string;
  displayName?: string;
  name?: string;
  email?: string;
  privileges?: string[];
  role?: string;
  type?: "access" | "refresh" | "mfa_temp";
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET", "dev-secret-change-in-production"),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type && payload.type !== "access") {
      throw new Error("Invalid token type: " + payload.type);
    }
    return payload;
  }
}

