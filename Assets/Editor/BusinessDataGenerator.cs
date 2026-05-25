#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using System.Collections.Generic;
using System.IO;

public static class BusinessDataGenerator
{
    [MenuItem("Entrepreneur/Generate Business Data Assets")]
    public static void GenerateAll()
    {
        const string folder = "Assets/ScriptableObjects/Businesses";
        if (!AssetDatabase.IsValidFolder(folder))
            AssetDatabase.CreateFolder("Assets/ScriptableObjects", "Businesses");

        var definitions = new List<(string id, string name, string desc, double cost, double rps, List<SkillRequirement> reqs, int minRep)>
        {
            ("lemonade_stand", "Lemonade Stand",
                "Your first business. Simple, humble, and a great start.",
                500, 0.5, new List<SkillRequirement>(), 0),

            ("freelance", "Freelance Services",
                "Offer your time and skills directly to clients.",
                2000, 2.0, new List<SkillRequirement>(), 0),

            ("blog", "Content Blog",
                "Build an audience and monetize through ads and sponsors.",
                8000, 6.0,
                new List<SkillRequirement> { new() { skill = SkillType.Marketing, minLevel = 2 } }, 0),

            ("food_truck", "Food Truck",
                "Hit the streets with delicious food and low overhead.",
                15000, 10.0,
                new List<SkillRequirement> { new() { skill = SkillType.Operations, minLevel = 2 } }, 0),

            ("tutoring", "Online Tutoring",
                "Teach what you know and scale through digital platforms.",
                12000, 8.0,
                new List<SkillRequirement> { new() { skill = SkillType.Technology, minLevel = 2 } }, 0),

            ("ecommerce_store", "E-commerce Store",
                "Sell products online and build a customer base.",
                50000, 30.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Marketing, minLevel = 3 },
                    new() { skill = SkillType.Operations, minLevel = 2 }
                }, 20),

            ("mobile_app", "Mobile App Studio",
                "Build and publish apps used by millions.",
                80000, 50.0,
                new List<SkillRequirement> { new() { skill = SkillType.Technology, minLevel = 3 } }, 20),

            ("consulting_firm", "Consulting Firm",
                "Advise companies and charge premium rates.",
                120000, 70.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Leadership, minLevel = 3 },
                    new() { skill = SkillType.Finance, minLevel = 2 }
                }, 30),

            ("restaurant", "Restaurant",
                "Create a dining experience that keeps customers coming back.",
                200000, 90.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Leadership, minLevel = 2 },
                    new() { skill = SkillType.Operations, minLevel = 3 },
                    new() { skill = SkillType.Creativity, minLevel = 2 }
                }, 30),

            ("digital_agency", "Digital Agency",
                "Run campaigns for top brands across all digital channels.",
                500000, 250.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Marketing, minLevel = 4 },
                    new() { skill = SkillType.Technology, minLevel = 2 },
                    new() { skill = SkillType.Creativity, minLevel = 3 }
                }, 60),

            ("investment_fund", "Investment Fund",
                "Put your capital to work and watch it compound.",
                2000000, 800.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Finance, minLevel = 5 },
                    new() { skill = SkillType.Networking, minLevel = 3 }
                }, 80),

            ("real_estate", "Real Estate Firm",
                "Buy, develop, and sell properties for massive returns.",
                3000000, 1000.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Finance, minLevel = 4 },
                    new() { skill = SkillType.Leadership, minLevel = 3 },
                    new() { skill = SkillType.Networking, minLevel = 2 }
                }, 100),

            ("saas_company", "SaaS Company",
                "Build recurring software revenue at massive scale.",
                5000000, 2000.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Technology, minLevel = 5 },
                    new() { skill = SkillType.Marketing, minLevel = 3 }
                }, 120),

            ("logistics", "Logistics Company",
                "Move goods globally and control critical supply chains.",
                8000000, 2500.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Operations, minLevel = 5 },
                    new() { skill = SkillType.Leadership, minLevel = 3 },
                    new() { skill = SkillType.Finance, minLevel = 3 }
                }, 150),

            ("tech_unicorn", "Tech Unicorn",
                "A billion-dollar tech company that defines an era.",
                50000000, 20000.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Technology, minLevel = 7 },
                    new() { skill = SkillType.Leadership, minLevel = 5 },
                    new() { skill = SkillType.Finance, minLevel = 4 },
                    new() { skill = SkillType.Networking, minLevel = 4 }
                }, 300),

            ("media_empire", "Media Empire",
                "Own the narrative across news, entertainment, and social.",
                80000000, 30000.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Marketing, minLevel = 7 },
                    new() { skill = SkillType.Creativity, minLevel = 6 },
                    new() { skill = SkillType.Networking, minLevel = 5 }
                }, 400),

            ("global_bank", "Global Bank",
                "Control capital flows and fund the world's biggest deals.",
                200000000, 80000.0,
                new List<SkillRequirement>
                {
                    new() { skill = SkillType.Finance, minLevel = 8 },
                    new() { skill = SkillType.Leadership, minLevel = 6 },
                    new() { skill = SkillType.Networking, minLevel = 5 }
                }, 500),
        };

        foreach (var def in definitions)
        {
            string path = $"{folder}/{def.id}.asset";
            var asset = AssetDatabase.LoadAssetAtPath<BusinessData>(path);
            if (asset == null)
            {
                asset = ScriptableObject.CreateInstance<BusinessData>();
                AssetDatabase.CreateAsset(asset, path);
            }
            asset.businessId = def.id;
            asset.businessName = def.name;
            asset.description = def.desc;
            asset.startupCost = def.cost;
            asset.baseRevenuePerSecond = def.rps;
            asset.skillRequirements = def.reqs;
            asset.minReputation = def.minRep;
            asset.minMoneyRequired = def.cost * 0.5;
            EditorUtility.SetDirty(asset);
        }

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log($"Generated {definitions.Count} business data assets in {folder}");
    }
}
#endif
