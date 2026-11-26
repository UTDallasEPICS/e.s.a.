/**
 * Purpose
 * Provide the auth logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import nodemailer from 'nodemailer'

// Use nodemailer.createTransport to initialize transporter.
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Use betterAuth to initialize auth.
export const auth = betterAuth({
  trustedOrigins: import.meta.dev ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'] : [],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Define delivery for the steps below.
      const delivery = ctx.context as typeof ctx.context & { emailDeliveryFailed?: boolean }
      // Check whether ctx.path === '/email-otp/send-verification-otp' && delivery.emailDeliveryFailed before running this branch.
      if (ctx.path === '/email-otp/send-verification-otp' && delivery.emailDeliveryFailed) {
        // Stop this operation and tell the caller why it cannot continue.
        throw new APIError('SERVICE_UNAVAILABLE', { message: 'ESA could not send the login email. The email sender settings need attention. No code was delivered; please contact the administrator.' })
      }
    }),
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  user: {
    additionalFields: {
      role: {
        type: 'string',
        input: false, // clients can't set their own role via updateUser
        defaultValue: 'USER',
      },
      active: {
        type: 'boolean',
        input: false, // clients can't activate themselves via updateUser
        defaultValue: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // The first user to sign in bootstraps the app as an active admin;
          // everyone after them defaults to an inactive USER an admin must approve.
          const existingUsers = await prisma.user.count()
          // Check whether existingUsers === 0 before running this branch.
          if (existingUsers === 0) {
            // Pass { data: { ...user, role: 'ADMIN', active: true } } back to the caller.
            return { data: { ...user, role: 'ADMIN', active: true } }
          }
          // Pass { data: user } back to the caller.
          return { data: user }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }, ctx) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Your ESA sign-in code',
            text: `Your ESA sign-in code is ${otp}. It expires shortly.`,
          })
        } catch {
          // Check whether ctx before running this branch.
          if (ctx) (ctx.context as typeof ctx.context & { emailDeliveryFailed?: boolean }).emailDeliveryFailed = true
          // Stop this operation and tell the caller why it cannot continue.
          throw new APIError('SERVICE_UNAVAILABLE', { message: 'Login email delivery failed. Check the sender SMTP settings.' })
        }
      },
    }),
  ],
})
