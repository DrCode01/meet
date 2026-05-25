// This ScriptableObject holds references to all BusinessData assets.
// Assign it to the BusinessManager in the Inspector and reference all
// BusinessData ScriptableObjects in the allBusinessDefinitions array.
// Business unlock order (by skill requirements):
//
// TIER 0 – No skills needed:
//   lemonade_stand      — Lemonade Stand        ($500 startup)
//   freelance           — Freelance Services    ($2,000 startup)
//
// TIER 1 – One skill at level 2+:
//   blog                — Content Blog          (Marketing 2)
//   food_truck          — Food Truck            (Operations 2)
//   tutoring            — Online Tutoring       (Technology 2)
//
// TIER 2 – Mixed skills level 3+:
//   ecommerce_store     — E-commerce Store      (Marketing 3, Operations 2)
//   mobile_app          — Mobile App Studio     (Technology 3)
//   consulting_firm     — Consulting Firm       (Leadership 3, Finance 2)
//   restaurant          — Restaurant            (Leadership 2, Operations 3, Creativity 2)
//
// TIER 3 – Specialized level 4-5:
//   digital_agency      — Digital Agency        (Marketing 4, Technology 2, Creativity 3)
//   investment_fund     — Investment Fund       (Finance 5, Networking 3)
//   real_estate         — Real Estate Firm      (Finance 4, Leadership 3, Networking 2)
//   saas_company        — SaaS Company          (Technology 5, Marketing 3)
//   logistics           — Logistics Company     (Operations 5, Leadership 3, Finance 3)
//
// TIER 4 – Endgame empire:
//   tech_unicorn        — Tech Unicorn          (Technology 7, Leadership 5, Finance 4, Networking 4)
//   media_empire        — Media Empire          (Marketing 7, Creativity 6, Networking 5)
//   global_bank         — Global Bank           (Finance 8, Leadership 6, Networking 5)
