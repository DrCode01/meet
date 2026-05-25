using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class MarketplacePanel : MonoBehaviour
{
    [SerializeField] private Transform unlockedContent;
    [SerializeField] private Transform lockedContent;
    [SerializeField] private GameObject marketplaceCardPrefab;
    [SerializeField] private Button closeButton;

    private List<GameObject> _cards = new();

    void OnEnable()
    {
        closeButton?.onClick.AddListener(() => UIManager.Instance.ShowHUD());
        RefreshList();
    }

    private void RefreshList()
    {
        foreach (var c in _cards) Destroy(c);
        _cards.Clear();

        var bm = GameManager.Instance.BusinessManager;

        foreach (var data in bm.GetUnlockedBusinesses())
        {
            var card = Instantiate(marketplaceCardPrefab, unlockedContent);
            card.GetComponent<MarketplaceCard>()?.Setup(data, true);
            _cards.Add(card);
        }

        foreach (var data in bm.GetLockedBusinesses())
        {
            var card = Instantiate(marketplaceCardPrefab, lockedContent);
            card.GetComponent<MarketplaceCard>()?.Setup(data, false);
            _cards.Add(card);
        }
    }
}
