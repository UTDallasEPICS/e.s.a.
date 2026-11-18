import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export const auth = betterAuth({
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
          if (existingUsers === 0) {
            return { data: { ...user, role: 'ADMIN', active: true } }
          }
          return { data: user }
        },
      },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // Dev-only: OTPs are sign-in credentials (this app has no password auth), so never log them in production.
        if (import.meta.dev) {
          console.log(`OTP for ${email} (${type}): ${otp}`)
        }
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: 'OTP for nuxt-template',
          html: `Your OTP is: ${otp}`,
        })
      },
    }),
  ],
})
