import { z } from "zod";

const optText = (max = 500) =>
  z.string().max(max).optional().or(z.literal(""));

const optDate = z.string().optional().or(z.literal(""));

export const intakeSchema = z.object({
  // Property + unit
  building:  z.string().min(1, "Property is required").max(200),
  unit_no:   z.string().min(1, "Unit number is required").max(50),

  // Personal
  last_name:   z.string().min(1, "Last name is required").max(100),
  first_name:  z.string().min(1, "First name is required").max(100),
  middle_name: optText(100),
  age:         optText(10),
  gender:      optText(50),
  nationality: optText(100),
  religion:    optText(100),
  civil_status: optText(50),
  perm_address: optText(500),
  rec_address:  optText(500),
  mobile:       z.string().min(1, "Mobile number is required").max(50),
  messenger:    optText(200),
  email:        z.string().email("Invalid email").min(1, "Email is required"),

  // Employment
  company:       optText(200),
  work_status:   optText(100),
  position:      optText(100),
  comp_addr:     optText(500),
  comp_tel:      optText(50),
  comp_email:    optText(200),
  comp_mssgr:    optText(200),
  marketing_src: optText(200),

  // Emergency 1 (required)
  ec1_name:  z.string().min(1, "Emergency contact 1 name is required").max(200),
  ec1_tel:   z.string().min(1, "Emergency contact 1 phone is required").max(50),
  ec1_email: optText(200),
  ec1_mssgr: optText(200),

  // Emergency 2 (optional)
  ec2_name:  optText(200),
  ec2_tel:   optText(50),
  ec2_email: optText(200),
  ec2_mssgr: optText(200),

  // Lease terms
  rate:          z.coerce.number().min(1, "Monthly rate is required"),
  occupancy_fee: z.coerce.number().min(0).optional().default(0),
  advance:       z.coerce.number().min(0).optional().default(0),
  sec_dep:       z.coerce.number().min(0).optional().default(0),
  utility_dep:   z.coerce.number().min(0).optional().default(0),
  rental_start:  z.string().min(1, "Rental start is required"),
  rental_end:    z.string().min(1, "Rental end is required"),
  due_date:      optDate,
  rep:           optText(200),

  // Add-ons — JSON-encoded string from the form:
  //   [{"text":"Foam","amount":500},{"text":"Curtains","amount":300}]
  // Legacy rows may be comma-separated: "Foam, Curtains"
  ad_ons: z
    .string()
    .max(5000)
    .optional()
    .or(z.literal("")),

  // Inspection
  num_per:   z.coerce.number().int().min(1).optional(),
  water:     optText(50),
  electric:  optText(50),

  switches:               optText(50),
  switches_com:           optText(500),
  sockets:                optText(50),
  sockets_com:            optText(500),
  cabinet:                optText(50),
  cabinet_com:            optText(500),
  lavatory:               optText(50),
  lavatory_com:           optText(500),
  light_bulb:             optText(50),
  light_bulb_com:         optText(500),
  faucets:                optText(50),
  faucets_com:            optText(500),
  shower_head:            optText(50),
  shower_head_com:        optText(500),
  declogging:             optText(50),
  declogging_com:         optText(500),
  toilet_bowl:            optText(50),
  toilet_bowl_com:        optText(500),
  kitchen_sink:           optText(50),
  kitchen_sink_com:       optText(500),
  wall_paint:             optText(50),
  wall_paint_com:         optText(500),
  optional_items:         optText(200),
  optional_items_com:     optText(500),
  door:                   optText(50),
  door_com:               optText(500),

  // Signature (base64 PNG data URL)
  signature: z.string().min(1, "Signature is required"),

  // Honeypot — must be empty
  website: z.string().optional().or(z.literal("")),
}).refine((d) => new Date(d.rental_end) > new Date(d.rental_start), {
  message: "Rental end must be after rental start",
  path: ["rental_end"],
});

export type IntakeInput = z.infer<typeof intakeSchema>;