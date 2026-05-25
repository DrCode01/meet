using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class BusinessCard : MonoBehaviour
{
    [SerializeField] private Image iconImage;
    [SerializeField] private TextMeshProUGUI nameText;
    [SerializeField] private TextMeshProUGUI levelText;
    [SerializeField] private TextMeshProUGUI revenueText;
    [SerializeField] private TextMeshProUGUI staffText;
    [SerializeField] private Button detailButton;
    [SerializeField] private Button upgradeButton;
    [SerializeField] private TextMeshProUGUI upgradeButtonText;

    private BusinessInstance _instance;

    public void SetupOwned(BusinessInstance instance)
    {
        _instance = instance;
        Refresh();

        detailButton?.onClick.AddListener(() => UIManager.Instance.ShowBusinessDetail(instance));
        upgradeButton?.onClick.AddListener(OnUpgrade);
        instance.OnChanged += _ => Refresh();
    }

    private void Refresh()
    {
        if (_instance == null) return;

        if (iconImage && _instance.Data.icon) iconImage.sprite = _instance.Data.icon;
        if (nameText) nameText.text = _instance.Data.businessName;
        if (levelText) levelText.text = $"Lv {_instance.Level}/{_instance.Data.maxLevel}";
        if (revenueText)
            revenueText.text = $"{PlayerData.FormatLargeNumber(_instance.GetRevenuePerSecond())}/s";
        if (staffText)
            staffText.text = $"Staff: {_instance.StaffCount}/{_instance.Data.maxStaff}";

        if (upgradeButton && upgradeButtonText)
        {
            bool canUpgrade = _instance.Level < _instance.Data.maxLevel;
            upgradeButton.gameObject.SetActive(canUpgrade);
            if (canUpgrade)
            {
                double cost = _instance.Data.GetUpgradeCost(_instance.Level);
                upgradeButtonText.text = $"Upgrade {PlayerData.FormatLargeNumber(cost)}";
            }
        }
    }

    private void OnUpgrade()
    {
        GameManager.Instance.BusinessManager.TryUpgradeBusiness(_instance);
    }
}
