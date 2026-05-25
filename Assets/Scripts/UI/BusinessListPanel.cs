using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class BusinessListPanel : MonoBehaviour
{
    [SerializeField] private Transform contentParent;
    [SerializeField] private GameObject businessCardPrefab;
    [SerializeField] private Button closeButton;

    private List<GameObject> _cards = new();

    void OnEnable()
    {
        closeButton?.onClick.AddListener(() => UIManager.Instance.ShowHUD());
        RefreshList();
        GameManager.Instance.BusinessManager.OnBusinessPurchased += _ => RefreshList();
        GameManager.Instance.BusinessManager.OnBusinessUpgraded += _ => RefreshList();
    }

    void OnDisable()
    {
        if (GameManager.Instance != null)
        {
            GameManager.Instance.BusinessManager.OnBusinessPurchased -= _ => RefreshList();
            GameManager.Instance.BusinessManager.OnBusinessUpgraded -= _ => RefreshList();
        }
    }

    private void RefreshList()
    {
        foreach (var card in _cards) Destroy(card);
        _cards.Clear();

        foreach (var biz in GameManager.Instance.BusinessManager.ActiveBusinesses)
        {
            var card = Instantiate(businessCardPrefab, contentParent);
            card.GetComponent<BusinessCard>()?.SetupOwned(biz);
            _cards.Add(card);
        }
    }
}
