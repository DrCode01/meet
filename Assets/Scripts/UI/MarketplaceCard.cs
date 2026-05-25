using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Text;

public class MarketplaceCard : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI nameText;
    [SerializeField] private TextMeshProUGUI descText;
    [SerializeField] private TextMeshProUGUI costText;
    [SerializeField] private TextMeshProUGUI requirementsText;
    [SerializeField] private Button buyButton;
    [SerializeField] private GameObject lockedOverlay;

    private BusinessData _data;
    private bool _unlocked;

    public void Setup(BusinessData data, bool unlocked)
    {
        _data = data;
        _unlocked = unlocked;

        if (nameText) nameText.text = data.businessName;
        if (descText) descText.text = data.description;
        if (costText) costText.text = $"Cost: {PlayerData.FormatLargeNumber(data.startupCost)}";

        if (requirementsText)
        {
            var sb = new StringBuilder();
            foreach (var req in data.skillRequirements)
                sb.AppendLine($"{req.skill} Lv {req.minLevel}+");
            if (data.minReputation > 0)
                sb.AppendLine($"Rep {data.minReputation}+");
            requirementsText.text = sb.ToString().TrimEnd();
        }

        if (lockedOverlay) lockedOverlay.SetActive(!unlocked);
        if (buyButton)
        {
            buyButton.interactable = unlocked;
            buyButton.onClick.AddListener(OnBuy);
        }
    }

    private void OnBuy()
    {
        if (GameManager.Instance.BusinessManager.TryPurchaseBusiness(_data))
        {
            UIManager.Instance.ShowBusinessList();
        }
    }
}
