using UnityEngine;
using System;
using System.Collections.Generic;

public enum SkillType
{
    Leadership,
    Technology,
    Marketing,
    Finance,
    Operations,
    Creativity,
    Networking
}

public class SkillSystem : MonoBehaviour
{
    public const int MaxSkillLevel = 10;

    private Dictionary<SkillType, int> _skills = new();
    public int SkillPoints { get; private set; }

    public event Action OnSkillChanged;

    public void Initialize()
    {
        foreach (SkillType skill in Enum.GetValues(typeof(SkillType)))
            _skills[skill] = 0;

        SkillPoints = 3; // starter points
        OnSkillChanged?.Invoke();
    }

    public void LoadFrom(SaveData data)
    {
        foreach (SkillType skill in Enum.GetValues(typeof(SkillType)))
            _skills[skill] = 0;

        if (data.skills != null)
        {
            foreach (var pair in data.skills)
            {
                if (Enum.TryParse<SkillType>(pair.Key, out var skillType))
                    _skills[skillType] = pair.Value;
            }
        }
        SkillPoints = data.skillPoints;
    }

    public Dictionary<string, int> GetSkillSnapshot()
    {
        var snapshot = new Dictionary<string, int>();
        foreach (var pair in _skills)
            snapshot[pair.Key.ToString()] = pair.Value;
        return snapshot;
    }

    public int GetSkillLevel(SkillType skill) =>
        _skills.TryGetValue(skill, out int level) ? level : 0;

    public bool CanUpgradeSkill(SkillType skill) =>
        SkillPoints > 0 && GetSkillLevel(skill) < MaxSkillLevel;

    public bool UpgradeSkill(SkillType skill)
    {
        if (!CanUpgradeSkill(skill)) return false;
        _skills[skill]++;
        SkillPoints--;
        OnSkillChanged?.Invoke();
        return true;
    }

    public void AwardSkillPoint(int count = 1)
    {
        SkillPoints += count;
        OnSkillChanged?.Invoke();
    }

    // Returns true if all required skill thresholds are met
    public bool MeetsRequirements(List<SkillRequirement> requirements)
    {
        foreach (var req in requirements)
        {
            if (GetSkillLevel(req.skill) < req.minLevel)
                return false;
        }
        return true;
    }

    public string GetSkillDescription(SkillType skill) => skill switch
    {
        SkillType.Leadership  => "Manage bigger teams and unlock HR-heavy businesses.",
        SkillType.Technology  => "Build tech products and unlock software businesses.",
        SkillType.Marketing   => "Grow brands and unlock media/retail businesses.",
        SkillType.Finance     => "Handle capital and unlock investment businesses.",
        SkillType.Operations  => "Optimize processes and unlock manufacturing/logistics.",
        SkillType.Creativity  => "Design and innovate — unlocks creative industries.",
        SkillType.Networking  => "Build connections — boosts revenue across all businesses.",
        _ => ""
    };
}

[Serializable]
public class SkillRequirement
{
    public SkillType skill;
    public int minLevel;
}
