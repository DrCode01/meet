using UnityEngine;
using System.Collections.Generic;

[CreateAssetMenu(fileName = "NewBusiness", menuName = "Entrepreneur/Business Data")]
public class BusinessData : ScriptableObject
{
    [Header("Identity")]
    public string businessId;
    public string businessName;
    [TextArea] public string description;
    public Sprite icon;

    [Header("Economics")]
    public double startupCost;
    public double baseRevenuePerSecond;
    public double upgradeCostMultiplier = 1.8;
    public int maxLevel = 10;
    public int maxStaff = 20;
    public double staffRevenueBonus = 0.05; // +5% per staff member

    [Header("Reputation")]
    public int reputationGainPerLevel = 5;

    [Header("Unlock Requirements")]
    public List<SkillRequirement> skillRequirements = new();
    public double minMoneyRequired;
    public int minReputation;

    [Header("Skill Point Rewards")]
    public int skillPointsOnFirstPurchase = 1;
    public int skillPointsOnMaxLevel = 2;

    public double GetUpgradeCost(int currentLevel)
    {
        return startupCost * Mathf.Pow((float)upgradeCostMultiplier, currentLevel);
    }

    public double GetRevenuePerSecond(int level, int staffCount)
    {
        double base_ = baseRevenuePerSecond * level;
        double staffBonus = 1.0 + (staffCount * staffRevenueBonus);
        return base_ * staffBonus;
    }

    public double GetStaffHireCost(int currentStaffCount)
    {
        return startupCost * 0.1 * (currentStaffCount + 1);
    }
}
