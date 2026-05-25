using UnityEngine;
using System;
using System.Collections.Generic;

[Serializable]
public class SaveData
{
    public string playerName;
    public double money;
    public double totalEarned;
    public int reputation;
    public Dictionary<string, int> skills = new();
    public int skillPoints;
    public List<BusinessSaveEntry> businesses = new();
    public long lastSaveTimestamp;
}

[Serializable]
public class BusinessSaveEntry
{
    public string businessId;
    public int level;
    public int staffCount;
    public bool isActive;
    public double accumulatedRevenue;
}

public static class SaveSystem
{
    private const string SaveKey = "EntrepreneurSave";

    public static void Save(PlayerData player, BusinessManager businessManager, SkillSystem skillSystem)
    {
        var data = new SaveData
        {
            playerName = player.PlayerName,
            money = player.Money,
            totalEarned = player.TotalEarned,
            reputation = player.Reputation,
            skills = skillSystem.GetSkillSnapshot(),
            skillPoints = skillSystem.SkillPoints,
            lastSaveTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        };

        foreach (var biz in businessManager.ActiveBusinesses)
        {
            data.businesses.Add(new BusinessSaveEntry
            {
                businessId = biz.Data.businessId,
                level = biz.Level,
                staffCount = biz.StaffCount,
                isActive = biz.IsActive,
                accumulatedRevenue = biz.AccumulatedRevenue
            });
        }

        string json = JsonUtility.ToJson(data);
        PlayerPrefs.SetString(SaveKey, json);
        PlayerPrefs.Save();
    }

    public static void Load(PlayerData player, BusinessManager businessManager, SkillSystem skillSystem)
    {
        if (!PlayerPrefs.HasKey(SaveKey))
            return;

        string json = PlayerPrefs.GetString(SaveKey);
        var data = JsonUtility.FromJson<SaveData>(json);

        player.LoadFrom(data);
        skillSystem.LoadFrom(data);

        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        double offlineSeconds = Mathf.Clamp((float)(now - data.lastSaveTimestamp), 0, 28800); // max 8h offline

        businessManager.LoadFrom(data, offlineSeconds);
    }

    public static void DeleteSave()
    {
        PlayerPrefs.DeleteKey(SaveKey);
        PlayerPrefs.Save();
    }

    public static bool HasSave() => PlayerPrefs.HasKey(SaveKey);
}
