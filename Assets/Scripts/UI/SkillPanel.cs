using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System;

public class SkillPanel : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI skillPointsText;
    [SerializeField] private Button closeButton;
    [SerializeField] private SkillRow[] skillRows;

    void OnEnable()
    {
        closeButton?.onClick.AddListener(() => UIManager.Instance.ShowHUD());
        GameManager.Instance.SkillSystem.OnSkillChanged += RefreshAll;
        RefreshAll();
    }

    void OnDisable()
    {
        if (GameManager.Instance?.SkillSystem != null)
            GameManager.Instance.SkillSystem.OnSkillChanged -= RefreshAll;
    }

    private void RefreshAll()
    {
        var ss = GameManager.Instance.SkillSystem;
        if (skillPointsText) skillPointsText.text = $"Skill Points: {ss.SkillPoints}";
        foreach (var row in skillRows) row.Refresh(ss);
    }
}

[Serializable]
public class SkillRow
{
    public SkillType skillType;
    public TextMeshProUGUI skillNameText;
    public TextMeshProUGUI levelText;
    public TextMeshProUGUI descText;
    public Slider levelBar;
    public Button upgradeButton;

    public void Refresh(SkillSystem ss)
    {
        int level = ss.GetSkillLevel(skillType);
        if (skillNameText) skillNameText.text = skillType.ToString();
        if (levelText) levelText.text = $"{level}/{SkillSystem.MaxSkillLevel}";
        if (descText) descText.text = ss.GetSkillDescription(skillType);
        if (levelBar)
        {
            levelBar.minValue = 0;
            levelBar.maxValue = SkillSystem.MaxSkillLevel;
            levelBar.value = level;
        }
        if (upgradeButton)
        {
            upgradeButton.interactable = ss.CanUpgradeSkill(skillType);
            upgradeButton.onClick.RemoveAllListeners();
            upgradeButton.onClick.AddListener(() =>
            {
                ss.UpgradeSkill(skillType);
            });
        }
    }
}
