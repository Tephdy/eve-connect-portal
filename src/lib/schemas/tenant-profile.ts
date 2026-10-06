import { z } from "zod";

const optionalText = (max = 500) =>
  z.string().max(max).optional().or(z.literal(""));

const optionalDate = z.string().optional().or(z.literal(""));

export const tenantProfileUpdateSchema = z.object({
  first_name:        z.string().min(1, "First name is required").max(100),
  middle_name:       optionalText(100),
  last_name:         z.string().min(1, "Last name is required").max(100),
  birth_date:        optionalDate,
  gender:            optionalText(50),
  nationality:       optionalText(100),
  religion:          optionalText(100),
  civil_status:      optionalText(50),
  permanent_address: optionalText(500),
  recent_address:    optionalText(500),
  phone:             z.string().min(1, "Mobile number is required").max(50),
  messenger_name:    optionalText(200),
  email:             z.string().email("Invalid email").min(1, "Email is required"),

  company:            optionalText(200),
  work_status:        optionalText(100),
  work_position:      optionalText(100),
  company_address:    optionalText(500),
  company_tel:        optionalText(50),
  company_email:      optionalText(200),
  company_messenger:  optionalText(200),

  marketing_source:   optionalText(200),

  ec1_name:      z.string().min(1, "Emergency contact name is required").max(200),
  ec1_phone:     z.string().min(1, "Emergency contact phone is required").max(50),
  ec1_email:     optionalText(200),
  ec1_messenger: optionalText(200),

  ec2_name:      optionalText(200),
  ec2_phone:     optionalText(50),
  ec2_email:     optionalText(200),
  ec2_messenger: optionalText(200),
});

export type TenantProfileUpdateInput = z.infer<typeof tenantProfileUpdateSchema>;

export const inspectionUpdateSchema = z.object({
  lease_id: z.string().uuid(),

  switches:               optionalText(50),
  switches_comment:       optionalText(500),
  sockets:                optionalText(50),
  sockets_comment:        optionalText(500),
  cabinet:                optionalText(50),
  cabinet_comment:        optionalText(500),
  lavatory:               optionalText(50),
  lavatory_comment:       optionalText(500),
  light_bulb:             optionalText(50),
  light_bulb_comment:     optionalText(500),
  faucets:                optionalText(50),
  faucets_comment:        optionalText(500),
  shower_head:            optionalText(50),
  shower_head_comment:    optionalText(500),
  declogging:             optionalText(50),
  declogging_comment:     optionalText(500),
  toilet_bowl:            optionalText(50),
  toilet_bowl_comment:    optionalText(500),
  kitchen_sink:           optionalText(50),
  kitchen_sink_comment:   optionalText(500),
  wall_paint:             optionalText(50),
  wall_paint_comment:     optionalText(500),
  optional_items:         optionalText(200),
  optional_items_comment: optionalText(500),
  door:                   optionalText(50),
  door_comment:           optionalText(500),

  number_of_persons: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ["number_of_persons"],
            message: "Number of persons is required and must be at least 1",
          },
        ]);
      }
      return Math.floor(n);
    }),
});

export type InspectionUpdateInput = z.infer<typeof inspectionUpdateSchema>;
